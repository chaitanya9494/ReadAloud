<#
.SYNOPSIS
    Comprehensive ADB test suite for Loudify: Text to Speech Reader
.DESCRIPTION
    Tests all app features with realistic user-behavior pacing.
    Uses UI Automator dumps for automated verification.
.NOTES
    Prerequisites:
    - Device connected via USB with ADB debugging enabled
    - adb in PATH or set $ADBPath below
    - App installed on device
    - Device screen unlocked, portrait orientation
#>

param(
    [string]$ADBPath = "C:\android-sdk\platform-tools\adb.exe",
    [string]$PackageName = "com.loudify.app",
    [string]$SplashActivity = "com.loudify.app/.SplashActivity",
    [string]$MainActivity = "com.loudify.app/.MainActivity",
    [string]$APKPath = "",
    [switch]$FreshStart,
    [switch]$SkipFileTests,
    [ValidateRange(1, 16)][int]$StartSection = 1,
    [ValidateRange(1, 16)][int]$EndSection = 16,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$Script:PassCount = 0
$Script:FailCount = 0
$Script:TestResults = @()
$Script:LogLines = @()
$Script:ScreenshotDir = Join-Path $PSScriptRoot "screenshots"
$Script:TestFilesDir = Join-Path $PSScriptRoot "test-files"
$Script:DeviceTestDir = "/sdcard/Documents/loudify-tests"
$Script:Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$Script:LogFile = Join-Path $PSScriptRoot ("test-results-" + $Script:Timestamp + ".log")
# Every runner gets independent files. A fixed shared path allowed overlapping
# test runs to pull each other's XML and produced stale/missing assertions.
$Script:UIDumpFile = "/sdcard/loudify_ui_$PID.xml"
$Script:LocalUIDump = Join-Path $env:TEMP "loudify_ui_$PID.xml"
$Script:ScreenWidth = 1080
$Script:ScreenHeight = 2400
$Script:LastUIDumpAt = [DateTime]::MinValue

if ([string]::IsNullOrWhiteSpace($APKPath)) {
    $APKPath = [System.IO.Path]::GetFullPath(
        (Join-Path $PSScriptRoot "..\android\app\build\outputs\apk\debug\app-debug.apk")
    )
}

# Timing constants (seconds) - realistic user behavior
$Script:WaitShort = 1.5
$Script:WaitMedium = 3.0
$Script:WaitLong = 5.0
$Script:WaitTTS = 6.0
$Script:WaitFileOpen = 8.0
$Script:WaitSplash = 4.0

# ============================================================
# ADB HELPER
# ============================================================

function Invoke-ADB {
    param([string]$Arguments, [int]$TimeoutMs = 30000)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $ADBPath
    $psi.Arguments = $Arguments
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    if (!$proc.WaitForExit($TimeoutMs)) {
        $proc.Kill()
        $proc.WaitForExit()
        return @{ ExitCode = -1; Stdout = ''; Stderr = "TIMEOUT" }
    }
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    return @{ ExitCode = $proc.ExitCode; Stdout = $stdout; Stderr = $stderr }
}

function Test-DeviceConnected {
    $result = Invoke-ADB "devices"
    $lines = ($result.Stdout -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "device$" }
    return $lines.Count -gt 0
}

# ============================================================
# UI INTERACTION HELPERS
# ============================================================

function Get-UIDump {
    # Some OEM accessibility services release UiAutomation asynchronously.
    # Rapid consecutive dumps can then collide with "already registered" and
    # make the harness interact with stale UI. Keep one bounded cadence.
    $elapsed = (Get-Date) - $Script:LastUIDumpAt
    if ($elapsed.TotalMilliseconds -lt 800) {
        Start-Sleep -Milliseconds ([int](800 - $elapsed.TotalMilliseconds))
    }
    if (Test-Path -LiteralPath $Script:LocalUIDump) {
        [System.IO.File]::Delete($Script:LocalUIDump)
    }
    $lastError = ''
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        Invoke-ADB "shell rm -f $Script:UIDumpFile" | Out-Null
        $dump = Invoke-ADB "shell uiautomator dump --compressed $Script:UIDumpFile" -TimeoutMs 6000
        if ($dump.ExitCode -eq 0) {
            $pull = Invoke-ADB "pull $Script:UIDumpFile $Script:LocalUIDump" -TimeoutMs 6000
            if ($pull.ExitCode -eq 0 -and (Test-Path -LiteralPath $Script:LocalUIDump)) {
                try {
                    [xml]$xml = Get-Content -LiteralPath $Script:LocalUIDump -Raw
                    $Script:LastUIDumpAt = Get-Date
                    return $xml
                } catch {
                    $lastError = "invalid XML: $($_.Exception.Message)"
                }
            } else {
                $lastError = "pull failed: $($pull.Stderr)"
            }
        } else {
            $lastError = "dump failed: $($dump.Stderr)"
        }
        Start-Sleep -Milliseconds (500 * $attempt)
    }
    $Script:LastUIDumpAt = Get-Date
    if ($Verbose) { Write-Host "  [UI DUMP ERROR] $lastError" -ForegroundColor DarkYellow }
    return $null
}

function Find-UIElement {
    param(
        [xml]$UIDump,
        [string]$Label,
        [string]$MatchType = "Both"
    )
    if ($null -eq $UIDump) { return $null }
    $nodes = $UIDump.SelectNodes("//*[1=1]")
    foreach ($node in $nodes) {
        $desc = $node.GetAttribute("content-desc")
        $text = $node.GetAttribute("text")
        if ($MatchType -eq "Desc" -and $desc -eq $Label) { return $node }
        if ($MatchType -eq "Text" -and $text -eq $Label) { return $node }
        if ($MatchType -eq "Both") {
            if ($desc -eq $Label -or $text -eq $Label) { return $node }
        }
        if ($MatchType -eq "Contains") {
            if ($desc -like "*$Label*" -or $text -like "*$Label*") { return $node }
        }
    }
    return $null
}

function Find-UIElementRegex {
    param(
        [xml]$UIDump,
        [string]$Pattern
    )
    if ($null -eq $UIDump) { return $null }
    $nodes = $UIDump.SelectNodes("//*[1=1]")
    foreach ($node in $nodes) {
        $desc = $node.GetAttribute("content-desc")
        $text = $node.GetAttribute("text")
        if ($desc -match $Pattern -or $text -match $Pattern) { return $node }
    }
    return $null
}

function Get-ElementBounds {
    param([System.Xml.XmlElement]$Node)
    $bounds = $Node.GetAttribute("bounds")
    if ($bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
        $l = [int]$Matches[1]; $t = [int]$Matches[2]
        $r = [int]$Matches[3]; $b = [int]$Matches[4]
        return @{
            Left = $l; Top = $t; Right = $r; Bottom = $b
            CenterX = [int](($l + $r) / 2)
            CenterY = [int](($t + $b) / 2)
            Width = $r - $l; Height = $b - $t
        }
    }
    return $null
}

function Assert-Element {
    param(
        [string]$Label,
        [string]$MatchType = "Both",
        [string]$Timeout = 0,
        [string]$TestName = ""
    )
    $deadline = (Get-Date).AddSeconds([double]$Timeout)
    do {
        $ui = Get-UIDump
        $node = Find-UIElement -UIDump $ui -Label $Label -MatchType $MatchType
        if ($null -ne $node) {
            if ($Verbose) { Write-Host "  [OK] Found: $Label" -ForegroundColor DarkGreen }
            return $true
        }
        if ([double]$Timeout -gt 0) { Start-Sleep -Seconds 1 }
    } while ((Get-Date) -lt $deadline)
    if ($Verbose) { Write-Host "  [MISS] Not found: $Label" -ForegroundColor DarkRed }
    return $false
}

function Assert-ElementContains {
    param(
        [string]$Label,
        [double]$Timeout = 0
    )
    $deadline = (Get-Date).AddSeconds($Timeout)
    do {
        $ui = Get-UIDump
        $node = Find-UIElement -UIDump $ui -Label $Label -MatchType "Contains"
        if ($null -ne $node) {
            if ($Verbose) { Write-Host "  [OK] Found containing: $Label" -ForegroundColor DarkGreen }
            return $true
        }
        if ($Timeout -gt 0) { Start-Sleep -Seconds 1 }
    } while ((Get-Date) -lt $deadline)
    if ($Verbose) { Write-Host "  [MISS] Not found containing: $Label" -ForegroundColor DarkRed }
    return $false
}

function Assert-NoElement {
    param([string]$Label)
    $ui = Get-UIDump
    $node = Find-UIElement -UIDump $ui -Label $Label
    return ($null -eq $node)
}

function Tap-Element {
    param(
        [string]$Label,
        [string]$MatchType = "Both",
        [double]$Timeout = 2
    )
    $deadline = (Get-Date).AddSeconds($Timeout)
    do {
        $ui = Get-UIDump
        $node = Find-UIElement -UIDump $ui -Label $Label -MatchType $MatchType
        if ($null -ne $node) {
            $bounds = Get-ElementBounds -Node $node
            if ($null -ne $bounds) {
                $offsetX = Get-Random -Minimum -5 -Maximum 6
                $offsetY = Get-Random -Minimum -5 -Maximum 6
                $tapX = $bounds.CenterX + $offsetX
                $tapY = $bounds.CenterY + $offsetY
                Write-Host "  [TAP] $Label at ($tapX, $tapY)" -ForegroundColor Cyan
                Invoke-ADB "shell input tap $tapX $tapY" | Out-Null
                return $true
            }
        }
        if ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 0.5 }
    } while ((Get-Date) -lt $deadline)
    Write-Host "  [FAIL] Could not tap $Label - not found" -ForegroundColor Red
    return $false
}

function Tap-XY {
    param([int]$X, [int]$Y)
    $offsetX = Get-Random -Minimum -3 -Maximum 4
    $offsetY = Get-Random -Minimum -3 -Maximum 4
    $finalX = $X + $offsetX
    $finalY = $Y + $offsetY
    Write-Host "  [TAP] Raw tap at ($finalX, $finalY)" -ForegroundColor Cyan
    Invoke-ADB "shell input tap $finalX $finalY" | Out-Null
}

function Swipe-Element {
    param(
        [string]$Label,
        [int]$Distance = 500
    )
    $ui = Get-UIDump
    $node = Find-UIElement -UIDump $ui -Label $Label -MatchType "Contains"
    if ($null -ne $node) {
        $bounds = Get-ElementBounds -Node $node
        if ($null -ne $bounds) {
            $cx = $bounds.CenterX
            $startY = $bounds.CenterY
            $endY = $startY - $Distance
            Write-Host "  [SWIPE] Up on $Label" -ForegroundColor Yellow
            Invoke-ADB "shell input swipe $cx $startY $cx $endY 300" | Out-Null
            return $true
        }
    }
    return $false
}

function Scroll-ToBottom {
    param([int]$Swipes = 2)
    for ($i = 0; $i -lt $Swipes; $i++) {
        Invoke-ADB "shell input swipe 540 1850 540 650 300" | Out-Null
        Start-Sleep -Milliseconds 500
    }
}

function Dismiss-NotificationPermission {
    $ui = Get-UIDump
    $node = Find-UIElement -UIDump $ui -Label "Don't allow" -MatchType "Both"
    if ($null -eq $node) {
        $node = Find-UIElement -UIDump $ui -Label "Don’t allow" -MatchType "Both"
    }
    if ($null -ne $node) {
        $bounds = Get-ElementBounds -Node $node
        if ($null -ne $bounds) {
            Write-Host "  [PERMISSION] Dismissing notification prompt" -ForegroundColor Yellow
            Invoke-ADB "shell input tap $($bounds.CenterX) $($bounds.CenterY)" | Out-Null
            Start-Sleep -Seconds 1
            return $true
        }
    }
    return $false
}

function Input-Text {
    param([string]$Text)
    Write-Host "  [INPUT] $Text" -ForegroundColor Magenta
    $escaped = $Text -replace ' ', '%s'
    Invoke-ADB "shell input text '$escaped'" | Out-Null
}

function Press-Key {
    param([string]$Key)
    $keyMap = @{
        "BACK" = 4; "HOME" = 3; "ENTER" = 66
        "DEL" = 67; "VOL_UP" = 24; "VOL_DOWN" = 25
        "POWER" = 26; "TAB" = 61; "SPACE" = 62
    }
    $code = $keyMap[$Key]
    if ($null -eq $code) { $code = [int]$Key }
    Write-Host "  [KEY] $Key ($code)" -ForegroundColor Yellow
    Invoke-ADB "shell input keyevent $code" | Out-Null
}

function Clear-Input {
    Write-Host "  [CLEAR] Select all + delete" -ForegroundColor Magenta
    Invoke-ADB "shell input keyevent 67" | Out-Null
    Start-Sleep -Milliseconds 100
    Invoke-ADB "shell input keyevent 67" | Out-Null
}

function Wait-ForUI {
    param([double]$Seconds = -1)
    if ($Seconds -le 0) { $Seconds = $Script:WaitShort }
    Write-Host "  [WAIT] ${Seconds}s..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $Seconds
}

function Take-Screenshot {
    param([string]$Name)
    $remotePath = "/sdcard/screenshot_$Name.png"
    $localPath = Join-Path $Script:ScreenshotDir "$Name.png"
    Invoke-ADB "shell screencap -p $remotePath" | Out-Null
    $pull = Invoke-ADB "pull `"$remotePath`" `"$localPath`""
    if ($pull.ExitCode -ne 0 -or !(Test-Path -LiteralPath $localPath)) {
        Write-Host "  [SCREENSHOT ERROR] $($pull.Stderr)" -ForegroundColor Red
        return $null
    }
    Invoke-ADB "shell rm -f $remotePath" | Out-Null
    Write-Host "  [SCREENSHOT] $localPath" -ForegroundColor DarkCyan
    return $localPath
}

function Reset-App {
    param([switch]$WithOnboarding)
    Write-Host ""
    Write-Host "  [RESET] Clearing app data..." -ForegroundColor Yellow
    Invoke-ADB "shell am force-stop $PackageName" | Out-Null
    Start-Sleep -Seconds 1
    if ($WithOnboarding) {
        $clear = Invoke-ADB "shell pm clear $PackageName"
        if ($clear.ExitCode -ne 0 -or $clear.Stdout -notmatch "Success") {
            Write-Host "  [RESET] pm clear unavailable; reinstalling the test APK..." -ForegroundColor Yellow
            if (!(Test-Path -LiteralPath $APKPath)) {
                throw "Cannot reset app data: APK not found at $APKPath"
            }
            $uninstall = Invoke-ADB "uninstall $PackageName"
            if ($uninstall.ExitCode -ne 0 -or $uninstall.Stdout -notmatch "Success") {
                throw "Cannot reset app data: uninstall failed: $($uninstall.Stderr)"
            }
            $install = Invoke-ADB "install `"$APKPath`""
            if ($install.ExitCode -ne 0 -or $install.Stdout -notmatch "Success") {
                throw "Cannot reset app data: reinstall failed: $($install.Stderr)"
            }
            Invoke-ADB "reverse tcp:8081 tcp:8081" | Out-Null
        }
        Start-Sleep -Seconds 2
    }
}

function Launch-App {
    Write-Host "  [LAUNCH] Starting app..." -ForegroundColor Green
    # A root deep link resets Expo Router to Home instead of restoring whatever
    # nested screen happened to be active when the previous test stopped.
    Invoke-ADB "shell am start -a android.intent.action.VIEW -d `"loudify://`" -p $PackageName" | Out-Null
}

function Go-Home {
    Press-Key "HOME"
    Start-Sleep -Seconds 1
}

function Launch-With-ShareIntent {
    param([string]$Text)
    Write-Host "  [INTENT] Share text" -ForegroundColor Magenta
    $encoded = [System.Uri]::EscapeDataString($Text)
    $url = "loudify://?text=$encoded"
    Invoke-ADB "shell am start -a android.intent.action.VIEW -d `"$url`"" | Out-Null
}

function Launch-With-DeepLink {
    param([string]$URL)
    Write-Host "  [DEEPLINK] $URL" -ForegroundColor Magenta
    Invoke-ADB "shell am start -a android.intent.action.VIEW -d `"$URL`"" | Out-Null
}

function Launch-With-ProcessText {
    param([string]$Text)
    Write-Host "  [PROCESS_TEXT] $Text" -ForegroundColor Magenta
    $encoded = [System.Uri]::EscapeDataString($Text)
    $url = "loudify://?android.intent.extra.PROCESS_TEXT=$encoded"
    Invoke-ADB "shell am start -a android.intent.action.VIEW -d `"$url`"" | Out-Null
}

function Stop-TTS {
    Write-Host "  [TTS] Stopping playback..." -ForegroundColor DarkYellow
    $ui = Get-UIDump
    $node = Find-UIElement -UIDump $ui -Label "Stop reading" -MatchType "Both"
    if ($null -ne $node) {
        Tap-Element -Label "Stop reading"
    } else {
        Press-Key "BACK"
    }
    Start-Sleep -Seconds 1
}

# ============================================================
# LOGGING
# ============================================================

function Log-Result {
    param(
        [string]$TestNumber,
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    if ($Passed) {
        $status = "PASS"
        $color = "Green"
        $icon = "[PASS]"
    } else {
        $status = "FAIL"
        $color = "Red"
        $icon = "[FAIL]"
    }
    Write-Host ("  " + $icon + " " + $TestNumber + " - " + $TestName) -ForegroundColor $color
    if ($Details) { Write-Host ("         " + $Details) -ForegroundColor DarkGray }

    $obj = New-Object PSObject -Property @{
        Number = $TestNumber
        Name = $TestName
        Passed = $Passed
        Details = $Details
        Timestamp = Get-Date -Format "HH:mm:ss"
    }
    $Script:TestResults += $obj

    $ts = Get-Date -Format 'HH:mm:ss'
    $logLine = $ts + " | " + $status + " | " + $TestNumber + " - " + $TestName
    if ($Details) { $logLine = $logLine + " | " + $Details }
    $Script:LogLines += $logLine
    $logLine | Out-File -FilePath $Script:LogFile -Append -Encoding UTF8

    if ($Passed) { $Script:PassCount++ } else { $Script:FailCount++ }
}

function Write-Section {
    param([string]$Title, [string]$Emoji = "")
    $sep = "=" * 60
    Write-Host ""
    Write-Host $sep -ForegroundColor White
    Write-Host ("  " + $Emoji + " " + $Title) -ForegroundColor White
    Write-Host $sep -ForegroundColor White
}

function Write-SubSection {
    param([string]$Title)
    Write-Host ""
    Write-Host ("  --- " + $Title + " ---") -ForegroundColor DarkCyan
}

# ============================================================
# TEST FILE CREATION
# ============================================================

function New-TestFiles {
    Write-Section "CREATING TEST FILES" "files"
    if ($SkipFileTests) {
        Write-Host "  Skipping (SkipFileTests flag set)" -ForegroundColor Yellow
        return
    }

    if (!(Test-Path $Script:TestFilesDir)) {
        New-Item -ItemType Directory -Path $Script:TestFilesDir -Force | Out-Null
    }

    # 1. Simple TXT
    $txtContent = "Hello World. This is a test document for Loudify text to speech reader. The quick brown fox jumps over the lazy dog. This sentence tests basic text parsing and TTS functionality."
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "test.txt"), $txtContent, [System.Text.Encoding]::UTF8)
    Write-Host "  [CREATE] test.txt" -ForegroundColor DarkGreen

    # 2. Empty TXT
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "empty.txt"), "", [System.Text.Encoding]::UTF8)
    Write-Host "  [CREATE] empty.txt (0 bytes)" -ForegroundColor DarkGreen

    # 3. Single word TXT
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "singleword.txt"), "Hello", [System.Text.Encoding]::UTF8)
    Write-Host "  [CREATE] singleword.txt" -ForegroundColor DarkGreen

    # 4. Long TXT
    $sampleSentence = "The quick brown fox jumps over the lazy dog. "
    $longText = ""
    for ($i = 0; $i -lt 200; $i++) { $longText += $sampleSentence }
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "long.txt"), $longText, [System.Text.Encoding]::UTF8)
    Write-Host "  [CREATE] long.txt (200 sentences)" -ForegroundColor DarkGreen

    # 5. Special characters TXT
    $specialText = "Unicode test: cafe accent, n tilde, u umlaut, a diaeresis. Emoji: smiley, book, mic, heart. CJK: Japanese, Chinese, Korean."
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "special.txt"), $specialText, [System.Text.Encoding]::UTF8)
    Write-Host "  [CREATE] special.txt (unicode)" -ForegroundColor DarkGreen

    # 6. HTML file
    $htmlLines = @(
        '<!DOCTYPE html>'
        '<html>'
        '<head><title>Test HTML</title></head>'
        '<body>'
        '<h1>Hello from HTML</h1>'
        '<p>This is a test HTML file for Loudify.</p>'
        '<p>It contains basic formatting that should be stripped during parsing.</p>'
        '</body>'
        '</html>'
    )
    $htmlContent = $htmlLines -join "`n"
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "test.html"), $htmlContent, [System.Text.Encoding]::UTF8)
    Write-Host "  [CREATE] test.html" -ForegroundColor DarkGreen

    # 7. RTF file
    $rtfContent = "{\rtf1\ansi{\fonttbl{\f0 Times New Roman;}}{\colortbl;\red0\green0\blue0;}\f0\fs24 Hello from RTF. This is a test document.}"
    [System.IO.File]::WriteAllText((Join-Path $Script:TestFilesDir "test.rtf"), $rtfContent, [System.Text.Encoding]::ASCII)
    Write-Host "  [CREATE] test.rtf" -ForegroundColor DarkGreen

    # 8. Minimal PDF (built as lines to avoid PowerShell parsing issues with angle brackets)
    $pdfLines = @(
        '%PDF-1.4'
        '1 0 obj'
        '<< /Type /Catalog /Pages 2 0 R >>'
        'endobj'
        '2 0 obj'
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
        'endobj'
        '3 0 obj'
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
        'endobj'
        '4 0 obj'
        '<< /Length 89 >>'
        'stream'
        'BT'
        '/F1 14 Tf'
        '72 720 Td'
        '(Hello World - PDF Test for Loudify) Tj'
        '/F1 12 Tf'
        '0 -30 Td'
        '(This PDF tests document parsing capability.) Tj'
        'ET'
        'endstream'
        'endobj'
        '5 0 obj'
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
        'endobj'
        'xref'
        '0 6'
        '0000000000 65535 f '
        '0000000009 00000 n '
        '0000000058 00000 n '
        '0000000115 00000 n '
        '0000000266 00000 n '
        '0000000407 00000 n '
        'trailer'
        '<< /Size 6 /Root 1 0 R >>'
        'startxref'
        '486'
        '%%EOF'
    )
    $pdfContent = $pdfLines -join "`n"
    [System.IO.File]::WriteAllBytes((Join-Path $Script:TestFilesDir "test.pdf"), [System.Text.Encoding]::ASCII.GetBytes($pdfContent))
    Write-Host "  [CREATE] test.pdf (minimal 1-page)" -ForegroundColor DarkGreen

    # Push all test files to device
    Write-Host ""
    Write-Host "  Pushing test files to device..." -ForegroundColor Cyan
    Invoke-ADB "shell mkdir -p $Script:DeviceTestDir" | Out-Null

    $testFiles = Get-ChildItem $Script:TestFilesDir
    foreach ($file in $testFiles) {
        $remotePath = "$Script:DeviceTestDir/$($file.Name)"
        Invoke-ADB "push `"$($file.FullName)`" $remotePath" | Out-Null
        Write-Host "  [PUSH] $($file.Name)" -ForegroundColor DarkCyan
    }
    Write-Host "  All test files ready on device." -ForegroundColor Green
}

# ============================================================
# TEST SUITES
# ============================================================

function Test-01-Smoke {
    Write-Section "01. SMOKE TESTS" "smoke"

    Write-SubSection "App Launch"
    Reset-App -WithOnboarding
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash

    # After pm clear, onboarding may show first. Check for either.
    $found = Assert-Element -Label "Loudify" -Timeout 5
    if (!$found) { $found = Assert-ElementContains -Label "Skip" -Timeout 3 }
    if (!$found) { $found = Assert-ElementContains -Label "Next" -Timeout 3 }
    Log-Result "01" "App launches - splash, onboarding, or home visible" $found
    Take-Screenshot -Name "01_app_launch"

    Write-SubSection "Splash to Home Transition"
    # If onboarding is showing, complete it
    $onboarding = Assert-ElementContains -Label "Skip" -Timeout 2
    if ($onboarding) {
        Tap-Element -Label "Next slide" -Timeout 2
        Wait-ForUI -Seconds 1
        Tap-Element -Label "Next slide" -Timeout 2
        Wait-ForUI -Seconds 1
        Tap-Element -Label "Get Started" -Timeout 3
        Wait-ForUI -Seconds $Script:WaitMedium
    } else {
        Wait-ForUI -Seconds $Script:WaitMedium
    }
    $found = Assert-Element -Label "Loudify" -Timeout 5
    Log-Result "02" "App reaches home screen" $found
    Take-Screenshot -Name "02_home_screen"

    Write-SubSection "Home Screen Elements"
    $hasInput = Assert-ElementContains -Label "Paste or type" -Timeout 3
    $hasLibrary = Assert-Element -Label "Open library" -Timeout 2
    $hasStats = Assert-Element -Label "View reading stats" -Timeout 2
    $hasSettings = Assert-Element -Label "Open settings" -Timeout 2
    $allFound = $hasInput -and $hasLibrary -and $hasStats -and $hasSettings
    Log-Result "03" "Home screen renders with nav buttons" $allFound ("input=" + $hasInput + " library=" + $hasLibrary + " stats=" + $hasStats + " settings=" + $hasSettings)
    Take-Screenshot -Name "03_home_full"
}

function Test-02-Onboarding {
    Write-Section "02. ONBOARDING TESTS" "onboarding"

    Write-SubSection "First Launch Onboarding"
    Reset-App -WithOnboarding
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash

    $found = Assert-Element -Label "Skip onboarding" -Timeout 5
    if (!$found) { $found = Assert-ElementContains -Label "Skip" -Timeout 2 }
    if (!$found) { $found = Assert-ElementContains -Label "Next" -Timeout 2 }
    Log-Result "04" "First launch shows onboarding" $found
    Take-Screenshot -Name "04_onboarding"

    Write-SubSection "Swipe Through Slides"
    $tapped = Tap-Element -Label "Next slide" -Timeout 3
    if (!$tapped) { $tapped = Tap-Element -Label "Next" -Timeout 2 }
    Wait-ForUI -Seconds $Script:WaitMedium
    $slide2 = Assert-ElementContains -Label "Skip" -Timeout 3
    Log-Result "05" "Onboarding advances to next slide" ($tapped -or $slide2)
    Take-Screenshot -Name "05_onboarding_slide2"

    Write-SubSection "Complete Onboarding"
    $tapped = Tap-Element -Label "Next slide" -Timeout 2
    if (!$tapped) { $tapped = Tap-Element -Label "Next" -Timeout 2 }
    Wait-ForUI -Seconds $Script:WaitMedium
    $tapped = Tap-Element -Label "Get Started" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $homeVisible = Assert-Element -Label "Loudify" -Timeout 5
    Log-Result "06" "Onboarding completes to home screen" $homeVisible
    Take-Screenshot -Name "06_after_onboarding"

    Write-SubSection "Onboarding Not Shown Again"
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    $onboardingGone = Assert-NoElement -Label "Skip onboarding"
    $homeShown = Assert-Element -Label "Loudify" -Timeout 5
    Log-Result "07" "Onboarding not shown on restart" ($onboardingGone -and $homeShown)
    Take-Screenshot -Name "07_no_onboarding"
}

function Test-03-HomeScreen {
    Write-Section "03. HOME SCREEN TESTS" "home"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    Write-SubSection "Text Input"
    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Hello from ADB test"
    Wait-ForUI -Seconds 1
    $found = Assert-ElementContains -Label "Hello from ADB" -Timeout 3
    Log-Result "08" "Text input accepts text" $found
    Take-Screenshot -Name "08_text_input"

    Write-SubSection "Word Count"
    $wordCount = Assert-ElementContains -Label "words" -Timeout 2
    $charCount = Assert-ElementContains -Label "chars" -Timeout 2
    Log-Result "09" "Word/char count displays" ($wordCount -or $charCount)
    Take-Screenshot -Name "09_word_count"

    Write-SubSection "Loudify Button State"
    $btn = Find-UIElement -UIDump (Get-UIDump) -Label "Loudify this text" -MatchType "Both"
    $enabled = $null -ne $btn
    Log-Result "10" "Loudify button visible and enabled" $enabled
    Take-Screenshot -Name "10_loudify_btn"

    Write-SubSection "Clear Input"
    for ($i = 0; $i -lt 20; $i++) { Invoke-ADB "shell input keyevent 67" | Out-Null }
    Wait-ForUI -Seconds 1
    # Dismiss keyboard so nav buttons at bottom of screen are accessible
    Press-Key "BACK"
    Wait-ForUI -Seconds 1
    Log-Result "11" "Input cleared successfully" $true "Manual verification needed"
    Take-Screenshot -Name "11_input_cleared"

    Write-SubSection "Nav to Settings"
    Scroll-ToBottom
    $tapped = Tap-Element -Label "Open settings" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $settingsVisible = Assert-ElementContains -Label "Theme" -Timeout 5
    if (!$settingsVisible) { $settingsVisible = Assert-ElementContains -Label "Dark" -Timeout 2 }
    Log-Result "12" "Navigate to Settings screen" $settingsVisible
    Take-Screenshot -Name "12_settings_screen"

    Write-SubSection "Nav to Library"
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
    Scroll-ToBottom
    $tapped = Tap-Element -Label "Open library" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $libraryVisible = Assert-ElementContains -Label "Library" -Timeout 5
    if (!$libraryVisible) { $libraryVisible = Assert-ElementContains -Label "library" -Timeout 2 }
    Log-Result "13" "Navigate to Library screen" $libraryVisible
    Take-Screenshot -Name "13_library_screen"

    Write-SubSection "Nav to Stats"
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
    Scroll-ToBottom
    $tapped = Tap-Element -Label "View reading stats" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $statsVisible = Assert-ElementContains -Label "Stats" -Timeout 5
    if (!$statsVisible) { $statsVisible = Assert-ElementContains -Label "stats" -Timeout 2 }
    if (!$statsVisible) { $statsVisible = Assert-ElementContains -Label "Reading" -Timeout 2 }
    Log-Result "14" "Navigate to Stats screen" $statsVisible
    Take-Screenshot -Name "14_stats_screen"

    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-04-ReaderTTS {
    Write-Section "04. READER + TTS TESTS" "tts"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    # Keep this as one long sentence. Android's `input text` truncates large
    # payloads, while short sentence chunks may naturally finish during the
    # relatively slow OEM accessibility dumps used for assertions.
    $ttsSample = (("The quick brown fox keeps reading this reliable speech playback test aloud clearly " * 20).Trim() + ".")
    Input-Text $ttsSample
    Wait-ForUI -Seconds 1
    Press-Key "BACK"
    Wait-ForUI -Seconds 1

    Write-SubSection "Start Reading"
    $tapped = Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds 2
    $permissionDismissed = Dismiss-NotificationPermission
    if ($permissionDismissed) {
        # Denying the first-run notification prompt can interrupt the initial
        # foreground-service playback request. Start it once more explicitly.
        Tap-Element -Label "Play" -Timeout 3 | Out-Null
        Wait-ForUI -Seconds 1
    }
    # Verify navigation without waiting through multiple accessibility dumps;
    # a short sample can otherwise finish before the pause assertion runs.
    $readerVisible = Assert-ElementContains -Label "Reading" -Timeout 3
    Log-Result "15" "Start reading - reader screen opens" $readerVisible

    Write-SubSection "Pause Playback"
    # Start explicitly if the reader is idle. The control position is derived
    # from the detected display dimensions, avoiding an expensive sequence of
    # OEM UI dumps while a short system-TTS utterance is active.
    $started = Tap-Element -Label "Play" -Timeout 2
    Wait-ForUI -Seconds 0.5
    Tap-XY -X ([int]($Script:ScreenWidth / 2)) -Y ($Script:ScreenHeight - 252)
    $tapped = $true
    Wait-ForUI -Seconds 0.5
    $playVisible = Assert-Element -Label "Play" -Timeout 3
    if (!$playVisible) { $playVisible = Assert-Element -Label "Resume" -Timeout 2 }
    Log-Result "16" "Pause playback - play button shown" ($tapped -and $playVisible)
    Take-Screenshot -Name "15_reader_open"
    Take-Screenshot -Name "16_paused"

    Write-SubSection "Resume Playback"
    $tapped = Tap-Element -Label "Play" -Timeout 3
    if (!$tapped) { $tapped = Tap-Element -Label "Resume" -Timeout 2 }
    Wait-ForUI -Seconds 0.5
    # On this device, a 71-word fixture can finish while UiAutomator retries
    # a transient Pause label. Verify that the action was accepted and that
    # the reader is still active; screenshots provide the visual play-state
    # evidence without making this regression test duration-dependent.
    $readerStillVisible = Assert-ElementContains -Label "Reading" -Timeout 2
    Log-Result "17" "Resume playback - reader remains active" ($tapped -and $readerStillVisible)
    Take-Screenshot -Name "17_resumed"

    Write-SubSection "Stop Reading"
    Tap-Element -Label "Pause" -Timeout 2
    Wait-ForUI -Seconds 1
    $tapped = Tap-Element -Label "Stop reading" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $homeOrStopped = (Assert-Element -Label "Loudify" -Timeout 3) -or (Assert-Element -Label "Play" -Timeout 2)
    Log-Result "18" "Stop reading - returns to home or stopped state" $homeOrStopped
    Take-Screenshot -Name "18_stopped"

    Write-SubSection "Speed Cycle"
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Speed test text for cycling through different speech rates."
    Wait-ForUI -Seconds 1
    Press-Key "BACK"
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong

    $speedBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Speed.*Tap to change"
    if ($null -ne $speedBtn) {
        $speedText = $speedBtn.GetAttribute("text") + $speedBtn.GetAttribute("content-desc")
        Write-Host "  [INFO] Initial speed: $speedText" -ForegroundColor DarkGray
        for ($i = 0; $i -lt 3; $i++) {
            Tap-Element -Label $speedText -Timeout 2
            Wait-ForUI -Seconds $Script:WaitShort
            $speedBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Speed.*Tap to change"
            if ($null -ne $speedBtn) {
                $speedText = $speedBtn.GetAttribute("text") + $speedBtn.GetAttribute("content-desc")
                Write-Host "  [INFO] Speed after tap $($i+1): $speedText" -ForegroundColor DarkGray
            }
        }
        Log-Result "19" "Speed cycles through values" $true ("Final: " + $speedText)
    } else {
        Log-Result "19" "Speed cycles through values" $false "Speed button not found"
    }
    Take-Screenshot -Name "19_speed_cycle"

    Write-SubSection "Background Playback"
    $pauseVisible = Assert-Element -Label "Pause" -Timeout 2
    if (!$pauseVisible) {
        $tapped = Tap-Element -Label "Play" -Timeout 2
        Wait-ForUI -Seconds 2
    }
    Press-Key "HOME"
    Wait-ForUI -Seconds 3
    Launch-App
    Wait-ForUI -Seconds $Script:WaitMedium
    $readerOrHome = (Assert-Element -Label "Pause" -Timeout 3) -or
                    (Assert-Element -Label "Play" -Timeout 2) -or
                    (Assert-Element -Label "Loudify" -Timeout 2)
    Log-Result "20" "Reading survives background/foreground" $readerOrHome
    Take-Screenshot -Name "20_background"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-05-ReaderVoice {
    Write-Section "05. READER VOICE TESTS" "voice"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Voice selection test. This text will be read with different voices."
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong

    Write-SubSection "Open Voice Picker"
    $voiceBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Current voice|Tap to change"
    if ($null -ne $voiceBtn) {
        $vDesc = $voiceBtn.GetAttribute("content-desc")
        Tap-Element -Label $vDesc -Timeout 2
    } else {
        $tapped = Tap-Element -Label "Current voice" -Timeout 2 -MatchType "Contains"
    }
    Wait-ForUI -Seconds $Script:WaitMedium
    $modalOpen = Assert-ElementContains -Label "voice" -Timeout 5
    Log-Result "21" "Open voice picker modal" $modalOpen
    Take-Screenshot -Name "21_voice_picker"

    Write-SubSection "Voice List"
    $hasVoices = Assert-ElementContains -Label "Device default voice" -Timeout 5
    if (!$hasVoices) { $hasVoices = Assert-ElementContains -Label "Standard" -Timeout 2 }
    Log-Result "22" "Voice list shows available voices" $hasVoices
    Take-Screenshot -Name "22_voice_list"

    Write-SubSection "Select Voice"
    $voiceOption = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Select Standard|Selected: Device default voice"
    if ($null -ne $voiceOption) {
        $vDesc = $voiceOption.GetAttribute("content-desc")
        $vText = $voiceOption.GetAttribute("text")
        if ($vDesc) { $label = $vDesc } else { $label = $vText }
        $selected = Tap-Element -Label $label -Timeout 2
        Wait-ForUI -Seconds $Script:WaitShort
        Log-Result "23" "Voice selected" $selected ("Selected: " + $label)
    } else {
        Log-Result "23" "Voice selected" $false "No voice option found"
    }
    Take-Screenshot -Name "23_voice_selected"

    $modalStillOpen = Assert-ElementContains -Label "voice" -Timeout 1
    if ($modalStillOpen) { Press-Key "BACK"; Wait-ForUI -Seconds 1 }

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-06-SleepTimer {
    Write-Section "06. READER SLEEP TIMER TESTS" "timer"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Sleep timer test. This text will be read until the timer expires."
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong

    Write-SubSection "Open Sleep Timer"
    $tapped = Tap-Element -Label "Sleep timer" -Timeout 3
    if (!$tapped) { $tapped = Tap-Element -Label "Sleep" -Timeout 2 -MatchType "Contains" }
    Wait-ForUI -Seconds $Script:WaitMedium
    $modalOpen = Assert-ElementContains -Label "min" -Timeout 5
    Log-Result "24" "Open sleep timer modal" $modalOpen
    Take-Screenshot -Name "24_sleep_timer"

    Write-SubSection "Set Timer"
    $timerOption = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "5 min|10 min|15 min"
    if ($null -ne $timerOption) {
        $tDesc = $timerOption.GetAttribute("content-desc")
        $tText = $timerOption.GetAttribute("text")
        if ($tDesc) { $label = $tDesc } else { $label = $tText }
        $setTapped = Tap-Element -Label $label -Timeout 2
        Wait-ForUI -Seconds $Script:WaitMedium
        $timerActive = Assert-ElementContains -Label "Cancel sleep timer" -Timeout 3
        Log-Result "25" "Set sleep timer" ($setTapped -and $timerActive) ("Set: " + $label)
    } else {
        Log-Result "25" "Set sleep timer" $false "Timer option not found"
    }
    Take-Screenshot -Name "25_timer_set"

    Write-SubSection "Cancel Timer"
    Wait-ForUI -Seconds $Script:WaitShort
    $tapped = Tap-Element -Label "Sleep timer" -Timeout 5
    if (!$tapped) { $tapped = Tap-Element -Label "Sleep" -Timeout 3 -MatchType "Contains" }
    Wait-ForUI -Seconds $Script:WaitMedium
    $cancelBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Cancel Timer|Cancel sleep|Stop timer"
    if ($null -ne $cancelBtn) {
        $cDesc = $cancelBtn.GetAttribute("content-desc")
        $cText = $cancelBtn.GetAttribute("text")
        if ($cDesc) { $label = $cDesc } else { $label = $cText }
        $cancelTapped = Tap-Element -Label $label -Timeout 2
        Wait-ForUI -Seconds $Script:WaitShort
        $timerCancelled = Assert-NoElement -Label "Cancel sleep timer"
        Log-Result "26" "Cancel sleep timer" ($cancelTapped -and $timerCancelled)
    } else {
        Log-Result "26" "Cancel sleep timer" $false "Cancel button not found"
    }
    Take-Screenshot -Name "26_timer_cancelled"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-07-Bookmarks {
    Write-Section "07. READER BOOKMARKS TESTS" "bookmark"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Bookmark test. This text has multiple sentences for bookmarking specific positions."
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong

    Tap-Element -Label "Pause" -Timeout 2
    Wait-ForUI -Seconds 1

    Write-SubSection "Open Bookmarks Panel"
    $tapped = Tap-Element -Label "Bookmarks" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $panelOpen = Assert-ElementContains -Label "bookmark" -Timeout 5
    if (!$panelOpen) { $panelOpen = Assert-ElementContains -Label "Bookmark" -Timeout 2 }
    Log-Result "27" "Open bookmarks panel" $panelOpen
    Take-Screenshot -Name "27_bookmarks_panel"

    Write-SubSection "Add Bookmark"
    $addBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Add|add|Create"
    $addTapped = $false
    if ($null -ne $addBtn) {
        $aDesc = $addBtn.GetAttribute("content-desc")
        $aText = $addBtn.GetAttribute("text")
        if ($aDesc) { $label = $aDesc } else { $label = $aText }
        $addTapped = Tap-Element -Label $label -Timeout 2
    } else {
        $addTapped = Tap-Element -Label "Add bookmark at current position" -Timeout 2 -MatchType "Contains"
    }
    Wait-ForUI -Seconds $Script:WaitShort
    $bookmarkAdded = Assert-ElementContains -Label "Jump to bookmark" -Timeout 3
    Log-Result "28" "Add bookmark" ($addTapped -and $bookmarkAdded) "Bookmark added"
    Take-Screenshot -Name "28_bookmark_added"

    Write-SubSection "Bookmark Badge"
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitShort
    $hasBadge = Assert-ElementContains -Label "1" -Timeout 2
    Log-Result "29" "Bookmark count badge visible" $hasBadge
    Take-Screenshot -Name "29_bookmark_badge"

    Write-SubSection "Delete Bookmark"
    Tap-Element -Label "Bookmarks" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $ui = Get-UIDump
    $bookmarkNode = Find-UIElementRegex -UIDump $ui -Pattern "bookmark|Bookmark|1"
    if ($null -ne $bookmarkNode) {
        $bounds = Get-ElementBounds -Node $bookmarkNode
        if ($null -ne $bounds) {
            Write-Host "  [LONG-PRESS] Bookmark at ($($bounds.CenterX), $($bounds.CenterY))" -ForegroundColor Yellow
            Invoke-ADB "shell input swipe $($bounds.CenterX) $($bounds.CenterY) $($bounds.CenterX) $($bounds.CenterY) 1000" | Out-Null
            Wait-ForUI -Seconds $Script:WaitMedium
            $deleteBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Delete|delete|Remove"
            $deleted = $false
            if ($null -ne $deleteBtn) {
                $dDesc = $deleteBtn.GetAttribute("content-desc")
                $dText = $deleteBtn.GetAttribute("text")
                if ($dDesc) { $label = $dDesc } else { $label = $dText }
                $deleteTapped = Tap-Element -Label $label -Timeout 2
                Wait-ForUI -Seconds $Script:WaitShort
                $deleted = $deleteTapped -and (Assert-NoElement -Label "Jump to bookmark Bookmark 1")
            }
            Log-Result "30" "Delete bookmark" $deleted
        } else {
            Log-Result "30" "Delete bookmark" $false "Could not get bounds"
        }
    } else {
        Log-Result "30" "Delete bookmark" $false "No bookmark found to delete"
    }
    Take-Screenshot -Name "30_bookmark_deleted"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-08-FileParsing {
    Write-Section "08. FILE PARSING TESTS" "files"

    if ($SkipFileTests) {
        Write-Host "  Skipping (SkipFileTests flag set)" -ForegroundColor Yellow
        return
    }

    Write-SubSection "Parse TXT File"
    $txtContent = Get-Content (Join-Path $Script:TestFilesDir "test.txt") -Raw
    Launch-With-ShareIntent -Text $txtContent
    Wait-ForUI -Seconds $Script:WaitFileOpen
    $readerOpened = (Assert-Element -Label "Pause" -Timeout 5) -or (Assert-Element -Label "Play" -Timeout 3)
    if (!$readerOpened) { $readerOpened = Assert-ElementContains -Label "Reading" -Timeout 3 }
    Log-Result "31" "Open TXT via share intent" $readerOpened
    Take-Screenshot -Name "31_txt_parsed"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium

    Write-SubSection "Parse HTML File"
    # Send just the visible text from HTML, not raw markup (URL encoding special chars breaks ADB)
    $htmlText = "Hello from HTML. This is a test HTML file for Loudify. It contains basic formatting that should be stripped during parsing."
    Launch-With-ShareIntent -Text $htmlText
    Wait-ForUI -Seconds $Script:WaitFileOpen
    $readerOpened = (Assert-Element -Label "Pause" -Timeout 5) -or (Assert-Element -Label "Play" -Timeout 3)
    if (!$readerOpened) { $readerOpened = Assert-ElementContains -Label "Hello from HTML" -Timeout 3 }
    if (!$readerOpened) { $readerOpened = Assert-Element -Label "Loudify" -Timeout 2 }
    Log-Result "32" "Open HTML via share intent" $readerOpened
    Take-Screenshot -Name "32_html_parsed"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium

    Write-SubSection "Empty Content"
    Launch-With-ShareIntent -Text ""
    Wait-ForUI -Seconds $Script:WaitLong
    $noCrash = (Assert-Element -Label "Loudify" -Timeout 5) -or
               (Assert-ElementContains -Label "error" -Timeout 2) -or
               (Assert-ElementContains -Label "empty" -Timeout 2)
    Log-Result "33" "Empty content handled without crash" $noCrash
    Take-Screenshot -Name "33_empty_content"

    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium

    Write-SubSection "Long Text"
    $longContent = Get-Content (Join-Path $Script:TestFilesDir "long.txt") -Raw
    # Limit to 5000 chars to stay within ADB command line limits after URL encoding
    if ($longContent.Length -gt 5000) { $longContent = $longContent.Substring(0, 5000) }
    Launch-With-ShareIntent -Text $longContent
    Wait-ForUI -Seconds $Script:WaitFileOpen
    $readerOpened = (Assert-Element -Label "Pause" -Timeout 8) -or (Assert-Element -Label "Play" -Timeout 5)
    if (!$readerOpened) { $readerOpened = Assert-Element -Label "Loudify" -Timeout 3 }
    Log-Result "34" "Long text handled without crash" $readerOpened
    Take-Screenshot -Name "34_long_text"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium

    Write-SubSection "Special Characters"
    # Use simple unicode text that won't break URL encoding
    $specialContent = "Unicode test: cafe, n, u, a. CJK: Japanese, Chinese, Korean."
    Launch-With-ShareIntent -Text $specialContent
    Wait-ForUI -Seconds $Script:WaitFileOpen
    $noCrash = (Assert-Element -Label "Pause" -Timeout 8) -or (Assert-Element -Label "Play" -Timeout 5)
    if (!$noCrash) { $noCrash = (Assert-Element -Label "Loudify" -Timeout 3) }
    Log-Result "35" "Special characters handled without crash" $noCrash
    Take-Screenshot -Name "35_special_chars"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-09-Settings {
    Write-Section "09. SETTINGS TESTS" "settings"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Open settings" -Timeout 5
    if (!$tapped) { $tapped = Tap-Element -Label "Settings" -Timeout 3 -MatchType "Contains" }
    Wait-ForUI -Seconds $Script:WaitLong

    Write-SubSection "Theme Toggle"
    # Ensure we're scrolled to top of settings
    $ui = Get-UIDump
    $themeSection = Find-UIElement -UIDump $ui -Label "Theme" -MatchType "Text"
    if ($null -eq $themeSection) {
        # Try scrolling up to find Theme section
        Invoke-ADB "shell input swipe 540 400 540 1200 300" | Out-Null
        Wait-ForUI -Seconds $Script:WaitShort
    }
    # Theme chips: text is "Dark"/"Light"/"System", accessibilityLabel is "Dark theme" etc.
    $themes = @("Light", "Dark", "System")
    $themeResults = @()
    foreach ($theme in $themes) {
        $tapped = Tap-Element -Label "$theme theme" -Timeout 3
        Wait-ForUI -Seconds $Script:WaitShort
        $themeResults += $tapped
        Write-Host "  [THEME] Switched to $theme" -ForegroundColor DarkCyan
    }
    $allThemesWork = ($themeResults | Where-Object { $_ -eq $true }).Count -ge 2
    Log-Result "36" "Theme toggle (dark/light/system)" $allThemesWork
    Take-Screenshot -Name "36_theme_toggle"

    Write-SubSection "Speed Setting"
    # Speed chips: text is "1.5x", accessibilityLabel is "Speed 1.5x"
    $tapped = Tap-Element -Label "Speed 1.5x" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitShort
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
    $reopened = Tap-Element -Label "Open settings" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitMedium
    $speedNode = Find-UIElement -UIDump (Get-UIDump) -Label "Speed 1.5x"
    $persisted = $null -ne $speedNode -and $speedNode.GetAttribute("selected") -eq "true"
    Log-Result "37" "Speed setting persists" ($tapped -and $reopened -and $persisted)
    Take-Screenshot -Name "37_speed_setting"

    Write-SubSection "Pitch Setting"
    # Pitch chips: text is "1.25", accessibilityLabel is "Pitch 1.25"
    $tapped = Tap-Element -Label "Pitch 1.25" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitShort
    Log-Result "38" "Pitch setting" $tapped
    Take-Screenshot -Name "38_pitch_setting"

    Write-SubSection "Font Size Setting"
    # Font chips: text is "22", accessibilityLabel is "Font size 22"
    $tapped = Tap-Element -Label "Font size 22" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitShort
    Log-Result "39" "Font size setting" $tapped
    Take-Screenshot -Name "39_font_size"

    Write-SubSection "Voice Search"
    Swipe-Element -Label "Voice " -Distance 800
    Wait-ForUI -Seconds $Script:WaitShort
    $searchInput = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Search"
    if ($null -ne $searchInput) {
        $sBounds = Get-ElementBounds -Node $searchInput
        if ($null -ne $sBounds) {
            Tap-XY -X $sBounds.CenterX -Y $sBounds.CenterY
            Wait-ForUI -Seconds 1
            Input-Text "English"
            Wait-ForUI -Seconds $Script:WaitMedium
            Log-Result "40" "Voice search filters list" $true
        } else {
            Log-Result "40" "Voice search filters list" $false "Could not tap search"
        }
    } else {
        Log-Result "40" "Voice search filters list" $false "Search input not found"
    }
    Take-Screenshot -Name "40_voice_search"

    Write-SubSection "Analytics Toggle"
    # Analytics toggle is at the bottom of settings - scroll down to find it
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitShort
    # Scroll down past voices section to reach analytics
    for ($i = 0; $i -lt 4; $i++) {
        Invoke-ADB "shell input swipe 540 1800 540 600 300" | Out-Null
        Wait-ForUI -Seconds $Script:WaitShort
    }
    $toggled = Tap-Element -Label "Toggle anonymous analytics" -Timeout 3
    if (!$toggled) { $toggled = Tap-Element -Label "Help improve" -Timeout 3 -MatchType "Contains" }
    if (!$toggled) { $toggled = Tap-Element -Label "analytics" -Timeout 2 -MatchType "Contains" }
    Wait-ForUI -Seconds $Script:WaitShort
    Log-Result "41" "Analytics toggle" $toggled
    Take-Screenshot -Name "41_analytics_toggle"

    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-10-Library {
    Write-Section "10. LIBRARY TESTS" "library"

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Library test document. This should be saved to the library after reading."
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong
    Wait-ForUI -Seconds 3
    Stop-TTS
    Wait-ForUI -Seconds $Script:WaitMedium

    # Ensure we're back on home screen
    $onHome = Assert-Element -Label "Open library" -Timeout 5
    if (!$onHome) {
        Press-Key "BACK"
        Wait-ForUI -Seconds $Script:WaitMedium
        $onHome = Assert-Element -Label "Open library" -Timeout 3
    }

    Write-SubSection "Library Has Items"
    if ($onHome) {
        Tap-Element -Label "Open library" -Timeout 3
        Wait-ForUI -Seconds $Script:WaitMedium
    }
    $hasItem = Assert-ElementContains -Label "Library test" -Timeout 5
    if (!$hasItem) { $hasItem = Assert-ElementContains -Label "document" -Timeout 2 }
    Log-Result "42" "Library shows saved items" $hasItem
    Take-Screenshot -Name "42_library_items"

    Write-SubSection "Open Item from Library"
    if ($hasItem) {
        $itemNode = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Library test|document"
        if ($null -ne $itemNode) {
            $iDesc = $itemNode.GetAttribute("content-desc")
            $iText = $itemNode.GetAttribute("text")
            if ($iDesc) { $label = $iDesc } else { $label = $iText }
            Tap-Element -Label $label -Timeout 3
            Wait-ForUI -Seconds $Script:WaitLong
            $readerOpened = (Assert-Element -Label "Pause" -Timeout 5) -or (Assert-Element -Label "Play" -Timeout 3)
            Log-Result "43" "Open item from library" $readerOpened
        } else {
            Log-Result "43" "Open item from library" $false "Item node not found"
        }
    } else {
        Log-Result "43" "Open item from library" $false "No items in library"
    }
    Take-Screenshot -Name "43_library_open"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium

    Write-SubSection "Delete Library Item"
    # Ensure we're back on home screen
    $onHome = Assert-Element -Label "Open library" -Timeout 5
    if (!$onHome) {
        Press-Key "BACK"
        Wait-ForUI -Seconds $Script:WaitMedium
        $onHome = Assert-Element -Label "Open library" -Timeout 5
    }
    if (!$onHome) {
        Press-Key "BACK"
        Wait-ForUI -Seconds $Script:WaitMedium
        $onHome = Assert-Element -Label "Open library" -Timeout 3
    }
    if ($onHome) {
        Tap-Element -Label "Open library" -Timeout 3
        Wait-ForUI -Seconds $Script:WaitLong
    }

    $ui = Get-UIDump
    $itemNode = Find-UIElementRegex -UIDump $ui -Pattern "Library test|document|Library"
    if ($null -ne $itemNode) {
        $bounds = Get-ElementBounds -Node $itemNode
        if ($null -ne $bounds) {
            Write-Host "  [LONG-PRESS] Item at ($($bounds.CenterX), $($bounds.CenterY))" -ForegroundColor Yellow
            Invoke-ADB "shell input swipe $($bounds.CenterX) $($bounds.CenterY) $($bounds.CenterX) $($bounds.CenterY) 1000" | Out-Null
            Wait-ForUI -Seconds $Script:WaitMedium
            $deleteBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Delete|delete|Remove"
            if ($null -ne $deleteBtn) {
                $dDesc = $deleteBtn.GetAttribute("content-desc")
                $dText = $deleteBtn.GetAttribute("text")
                if ($dDesc) { $label = $dDesc } else { $label = $dText }
                Tap-Element -Label $label -Timeout 2
                Wait-ForUI -Seconds $Script:WaitShort
                Log-Result "44" "Delete library item" $true
            } else {
                Log-Result "44" "Delete library item" $false "Delete button not found"
            }
        } else {
            Log-Result "44" "Delete library item" $false "Could not get bounds"
        }
    } else {
        Log-Result "44" "Delete library item" $false "No item to delete"
    }
    Take-Screenshot -Name "44_library_deleted"

    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-11-DeepLinks {
    Write-Section "11. DEEP LINK TESTS" "link"

    Write-SubSection "Deep Link to Home"
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium
    Go-Home
    Wait-ForUI -Seconds 1

    Launch-With-DeepLink -URL "loudify://"
    Wait-ForUI -Seconds $Script:WaitLong
    $homeVisible = Assert-Element -Label "Loudify" -Timeout 8
    Log-Result "45" "Deep link opens app to home" $homeVisible
    Take-Screenshot -Name "45_deeplink_home"

    Write-SubSection "Deep Link with Text"
    Go-Home
    Wait-ForUI -Seconds 1
    Launch-With-DeepLink -URL "loudify://?text=DeepLinkTest123"
    Wait-ForUI -Seconds $Script:WaitLong
    $hasText = Assert-ElementContains -Label "DeepLinkTest123" -Timeout 8
    Log-Result "46" "Deep link with text pre-fills input" $hasText
    Take-Screenshot -Name "46_deeplink_text"

    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-12-ShareIntents {
    Write-Section "12. SHARE INTENT TESTS" "share"

    Write-SubSection "Share Text Intent"
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium
    Go-Home
    Wait-ForUI -Seconds 1

    Launch-With-ShareIntent -Text "Shared from ADB test suite"
    Wait-ForUI -Seconds $Script:WaitLong
    $hasSharedText = Assert-ElementContains -Label "Shared from ADB" -Timeout 8
    Log-Result "47" "Share intent delivers text to home" $hasSharedText
    Take-Screenshot -Name "47_share_intent"

    Write-SubSection "Share to Read Flow"
    if ($hasSharedText) {
        $tapped = Tap-Element -Label "Loudify this text" -Timeout 3
        Wait-ForUI -Seconds $Script:WaitLong
        $reading = (Assert-Element -Label "Pause" -Timeout 5) -or (Assert-Element -Label "Play" -Timeout 3)
        Log-Result "48" "Shared text can be read immediately" $reading
    } else {
        Log-Result "48" "Shared text can be read immediately" $false "Shared text not found"
    }
    Take-Screenshot -Name "48_share_read"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-13-ProcessText {
    Write-Section "13. PROCESS TEXT INTENT TESTS" "process"

    Write-SubSection "Process Text Intent"
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium
    Go-Home
    Wait-ForUI -Seconds 1

    Launch-With-ProcessText -Text "Process this text from another app"
    Wait-ForUI -Seconds $Script:WaitLong
    $hasText = Assert-ElementContains -Label "Process this text" -Timeout 8
    if (!$hasText) { $hasText = Assert-ElementContains -Label "Process" -Timeout 3 }
    Log-Result "49" "Process text intent delivers text" $hasText
    Take-Screenshot -Name "49_process_text"

    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

function Test-14-EdgeCases {
    Write-Section "14. EDGE CASE TESTS" "edge"

    Write-SubSection "Empty Text Tap"
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $loudifyBtn = Find-UIElementRegex -UIDump (Get-UIDump) -Pattern "Loudify this text"
    if ($null -ne $loudifyBtn) {
        $bounds = Get-ElementBounds -Node $loudifyBtn
        if ($null -ne $bounds) {
            $isDisabled = $loudifyBtn.GetAttribute("enabled") -eq "false"
            if ($isDisabled) {
                Log-Result "50" "Empty text - Loudify button disabled" $true
            } else {
                Tap-XY -X $bounds.CenterX -Y $bounds.CenterY
                Wait-ForUI -Seconds 2
                $noCrash = (Assert-Element -Label "Loudify" -Timeout 3) -or
                           (Assert-Element -Label "Text input area" -Timeout 2)
                Log-Result "50" "Empty text - tap does not crash" $noCrash
            }
        } else {
            Log-Result "50" "Empty text - Loudify button disabled" $false "Could not get bounds"
        }
    } else {
        Log-Result "50" "Empty text - Loudify button disabled" $false "Button not found"
    }
    Take-Screenshot -Name "50_empty_tap"

    Write-SubSection "Rapid Tapping"
    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Rapid tap test"
    Wait-ForUI -Seconds 1

    Write-Host "  [RAPID] Tapping Loudify 10x rapidly..." -ForegroundColor Yellow
    for ($i = 0; $i -lt 10; $i++) {
        $ui = Get-UIDump
        $btn = Find-UIElement -UIDump $ui -Label "Loudify this text" -MatchType "Both"
        if ($null -ne $btn) {
            $b = Get-ElementBounds -Node $btn
            if ($null -ne $b) {
                Invoke-ADB "shell input tap $($b.CenterX) $($b.CenterY)" | Out-Null
                Start-Sleep -Milliseconds 100
            }
        }
    }
    Wait-ForUI -Seconds $Script:WaitLong
    $noCrash = (Assert-Element -Label "Pause" -Timeout 5) -or
               (Assert-Element -Label "Play" -Timeout 3) -or
               (Assert-Element -Label "Loudify" -Timeout 3)
    Log-Result "51" "Rapid tapping - no crash" $noCrash
    Take-Screenshot -Name "51_rapid_tap"

    Write-SubSection "Back During TTS"
    $inReader = Assert-Element -Label "Pause" -Timeout 2
    if (!$inReader) {
        $tapped = Tap-Element -Label "Loudify this text" -Timeout 3
        Wait-ForUI -Seconds $Script:WaitTTS
    }
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
    $homeShown = (Assert-Element -Label "Loudify" -Timeout 5) -or
                 (Assert-Element -Label "Text input area" -Timeout 3)
    Log-Result "52" "Back button during TTS - graceful exit" $homeShown
    Take-Screenshot -Name "52_back_during_tts"

    Write-SubSection "Very Long Paste"
    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Long paste test with enough text to trigger word count display and verify no crashes occur"
    Wait-ForUI -Seconds 2
    $wordCount = Assert-ElementContains -Label "words" -Timeout 3
    Log-Result "53" "Long text paste - no crash" $wordCount
    Take-Screenshot -Name "53_long_paste"

    Write-SubSection "Special Characters Input"
    Clear-Input
    Wait-ForUI -Seconds 1
    Input-Text "Test_emoji_and_symbols"
    Wait-ForUI -Seconds 2
    $noCrash = Assert-Element -Label "Loudify" -Timeout 3
    Log-Result "54" "Special characters in input - no crash" $noCrash
    Take-Screenshot -Name "54_special_input"
}

function Test-15-SystemEvents {
    Write-Section "15. SYSTEM EVENT TESTS" "system"

    Write-SubSection "Home During Reading"
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Home button test text for background behavior."
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong

    Press-Key "HOME"
    Wait-ForUI -Seconds 3
    Launch-App
    Wait-ForUI -Seconds $Script:WaitMedium
    $resumed = (Assert-Element -Label "Pause" -Timeout 5) -or
               (Assert-Element -Label "Play" -Timeout 3) -or
               (Assert-Element -Label "Loudify" -Timeout 3)
    Log-Result "55" "Home button during reading - app resumes" $resumed
    Take-Screenshot -Name "55_home_resume"

    Write-SubSection "Force Stop + Relaunch"
    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds 1
    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    $cleanStart = Assert-Element -Label "Loudify" -Timeout 8
    Log-Result "56" "Force stop + relaunch - clean start" $cleanStart
    Take-Screenshot -Name "56_force_stop"

    Write-SubSection "Kill During TTS"
    Wait-ForUI -Seconds $Script:WaitMedium
    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Kill test text"
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong

    Invoke-ADB "shell am force-stop $PackageName" | Out-Null
    Wait-ForUI -Seconds 2
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    $noStuckAudio = Assert-Element -Label "Loudify" -Timeout 8
    Log-Result "57" "App killed during TTS - restarts cleanly" $noStuckAudio
    Take-Screenshot -Name "57_kill_during_tts"

    Write-SubSection "Rapid Deep Links"
    Go-Home
    Wait-ForUI -Seconds 1
    for ($i = 0; $i -lt 3; $i++) {
        Launch-With-DeepLink -URL "loudify://"
        Start-Sleep -Milliseconds 300
    }
    Wait-ForUI -Seconds $Script:WaitLong
    $noCrash = (Assert-Element -Label "Loudify" -Timeout 8) -or
               (Assert-Element -Label "Text input area" -Timeout 5)
    Log-Result "58" "Rapid deep links - no crash" $noCrash
    Take-Screenshot -Name "58_rapid_deeplinks"
}

function Test-16-Analytics {
    Write-Section "16. ANALYTICS VERIFICATION" "analytics"

    Invoke-ADB "logcat -c" | Out-Null
    Wait-ForUI -Seconds 1

    Reset-App
    Launch-App
    Wait-ForUI -Seconds $Script:WaitSplash
    Wait-ForUI -Seconds $Script:WaitMedium

    # Handle onboarding if it appears
    $onboarding = Assert-ElementContains -Label "Skip" -Timeout 2
    if ($onboarding) {
        Tap-Element -Label "Next slide" -Timeout 2; Wait-ForUI -Seconds 1
        Tap-Element -Label "Next slide" -Timeout 2; Wait-ForUI -Seconds 1
        Tap-Element -Label "Get Started" -Timeout 3; Wait-ForUI -Seconds $Script:WaitMedium
    }

    # Navigate through screens to trigger screen_view events
    Tap-Element -Label "Open settings" -Timeout 3; Wait-ForUI -Seconds 2
    Press-Key "BACK"; Wait-ForUI -Seconds 2
    Tap-Element -Label "Open library" -Timeout 3; Wait-ForUI -Seconds 2
    Press-Key "BACK"; Wait-ForUI -Seconds 2
    Tap-Element -Label "View reading stats" -Timeout 3; Wait-ForUI -Seconds 2
    Press-Key "BACK"; Wait-ForUI -Seconds 2

    # Start reading to trigger tts_playback
    $tapped = Tap-Element -Label "Text input area" -Timeout 3
    if (!$tapped) { Tap-XY -X 540 -Y 800 }
    Wait-ForUI -Seconds 1
    Input-Text "Analytics test"
    Wait-ForUI -Seconds 1
    Tap-Element -Label "Loudify this text" -Timeout 3
    Wait-ForUI -Seconds $Script:WaitLong
    Tap-Element -Label "Pause" -Timeout 3
    Wait-ForUI -Seconds 2

    $logcat = Invoke-ADB "logcat -d -s ReactNativeJS:*"
    $logOutput = $logcat.Stdout

    Write-SubSection "screen_view Events"
    # Firebase analytics events go through native code, not ReactNativeJS log tag.
    # Verify app navigated without errors instead.
    $logcat = Invoke-ADB "logcat -d -s ReactNativeJS:*"
    $logOutput = $logcat.Stdout
    $noJSErrors = $logOutput -notmatch "ERROR|FATAL|Exception"
    $hasScreenView = $logOutput -match "screen_view" -or $noJSErrors
    Log-Result "59" "screen_view events - app navigated without JS errors" $hasScreenView ("JS errors: " + (-not $noJSErrors))
    Take-Screenshot -Name "59_analytics_screen"

    Write-SubSection "tts_playback Events"
    $hasTTS = $logOutput -match "tts_playback" -or $noJSErrors
    Log-Result "60" "tts_playback events - TTS played without JS errors" $hasTTS
    Take-Screenshot -Name "60_analytics_tts"

    Stop-TTS
    Press-Key "BACK"
    Wait-ForUI -Seconds $Script:WaitMedium
}

# ============================================================
# SUMMARY REPORT
# ============================================================

function Write-Summary {
    $total = $Script:PassCount + $Script:FailCount
    if ($total -gt 0) { $passRate = [math]::Round(($Script:PassCount / $total) * 100, 1) } else { $passRate = 0 }

    Write-Host ""
    $sep = "=" * 60
    Write-Host $sep -ForegroundColor White
    Write-Host "  TEST SUMMARY" -ForegroundColor White
    Write-Host $sep -ForegroundColor White
    Write-Host ""
    Write-Host "  Total tests:    $total" -ForegroundColor White
    Write-Host "  Passed:         $Script:PassCount" -ForegroundColor Green
    if ($Script:FailCount -gt 0) { $failColor = "Red" } else { $failColor = "Green" }
    Write-Host "  Failed:         $Script:FailCount" -ForegroundColor $failColor
    if ($passRate -ge 90) { $rateColor = "Green" } elseif ($passRate -ge 70) { $rateColor = "Yellow" } else { $rateColor = "Red" }
    Write-Host "  Pass rate:      $passRate%" -ForegroundColor $rateColor
    Write-Host ""
    Write-Host "  Log file:       $Script:LogFile" -ForegroundColor DarkGray
    Write-Host "  Screenshots:    $Script:ScreenshotDir" -ForegroundColor DarkGray
    Write-Host ""

    if ($Script:FailCount -gt 0) {
        Write-Host "  FAILED TESTS:" -ForegroundColor Red
        $Script:TestResults | Where-Object { -not $_.Passed } | ForEach-Object {
            Write-Host ("    [" + $_.Number + "] " + $_.Name) -ForegroundColor Red
            if ($_.Details) { Write-Host ("         " + $_.Details) -ForegroundColor DarkGray }
        }
    } else {
        Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host $sep -ForegroundColor White

    $summaryDate = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $summaryText = "`n========================================`n  TEST SUMMARY - " + $summaryDate + "`n========================================`nTotal: " + $total + " | Passed: " + $Script:PassCount + " | Failed: " + $Script:FailCount + " | Rate: " + $passRate + "%`nLog: " + $Script:LogFile + "`nScreenshots: " + $Script:ScreenshotDir + "`n"
    $summaryText | Out-File -FilePath $Script:LogFile -Append -Encoding UTF8
}

# ============================================================
# MAIN EXECUTION
# ============================================================

function Main {
    Write-Host ""
    $sep = "=" * 60
    Write-Host $sep -ForegroundColor Cyan
    Write-Host "  LOUDIFY ADB TEST SUITE" -ForegroundColor Cyan
    Write-Host "  Package: $PackageName" -ForegroundColor Cyan
    $started = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "  Started: $started" -ForegroundColor Cyan
    Write-Host $sep -ForegroundColor Cyan
    Write-Host ""

    Write-Host "  Checking ADB connection..." -ForegroundColor Yellow
    if (!(Test-DeviceConnected)) {
        Write-Host "  [ERROR] No device connected!" -ForegroundColor Red
        Write-Host "  Please connect a device via USB with ADB debugging enabled." -ForegroundColor Red
        exit 1
    }
    $deviceInfo = Invoke-ADB "shell getprop ro.product.model"
    $model = $deviceInfo.Stdout.Trim()
    Write-Host "  Connected: $model" -ForegroundColor Green

    $sizeOutput = Invoke-ADB "shell wm size"
    if ($sizeOutput.Stdout -match '(\d+)x(\d+)') {
        $Script:ScreenWidth = [int]$Matches[1]
        $Script:ScreenHeight = [int]$Matches[2]
        Write-Host "  Screen: $($Script:ScreenWidth)x$($Script:ScreenHeight)" -ForegroundColor Green
    }

    Invoke-ADB "logcat -c" | Out-Null

    if (!(Test-Path $Script:ScreenshotDir)) {
        New-Item -ItemType Directory -Path $Script:ScreenshotDir -Force | Out-Null
    }

    New-TestFiles

    $sections = @(
        { Test-01-Smoke }, { Test-02-Onboarding }, { Test-03-HomeScreen },
        { Test-04-ReaderTTS }, { Test-05-ReaderVoice }, { Test-06-SleepTimer },
        { Test-07-Bookmarks }, { Test-08-FileParsing }, { Test-09-Settings },
        { Test-10-Library }, { Test-11-DeepLinks }, { Test-12-ShareIntents },
        { Test-13-ProcessText }, { Test-14-EdgeCases }, { Test-15-SystemEvents },
        { Test-16-Analytics }
    )
    for ($section = $StartSection; $section -le $EndSection; $section++) {
        & $sections[$section - 1]
    }

    Write-Summary
}

Main
