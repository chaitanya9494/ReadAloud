import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Billing is not part of the shipped app yet. Keeping this optional path
// disabled avoids bundling a missing native module (and its substantial
// dependency footprint) into every production build. When Pro is launched,
// wire it to Play Billing deliberately in a dedicated release.
let IAP: any = null;

const PRO_KEY = 'loudify_pro';
const TIP_KEY = 'loudify_tips';

const PRO_SKU = 'pro_unlock';
const TIP_SKUS = ['tip_1', 'tip_3', 'tip_5'];
const ALL_SKUS = [PRO_SKU, ...TIP_SKUS];

export type ProFeature =
  | 'background_audio'
  | 'url_reading'
  | 'ocr_scanner'
  | 'export_mp3'
  | 'pronunciation';

export const PRO_FEATURES: Record<ProFeature, { label: string; icon: string; desc: string }> = {
  background_audio: {
    label: 'Background Playback',
    icon: 'headset-outline',
    desc: 'Keep listening when you switch apps or lock your screen',
  },
  url_reading: {
    label: 'URL Reading',
    icon: 'globe-outline',
    desc: 'Paste any web link and listen to the article',
  },
  ocr_scanner: {
    label: 'Camera Scanner',
    icon: 'camera-outline',
    desc: 'Snap a photo of any text and have it read aloud',
  },
  export_mp3: {
    label: 'Audio Export',
    icon: 'download-outline',
    desc: 'Export text as audio files to share or listen offline',
  },
  pronunciation: {
    label: 'Pronunciation Editor',
    icon: 'create-outline',
    desc: 'Customize how specific words are pronounced',
  },
};

export const PRO_PRICE_FALLBACK = '$3.99';
export const PRO_PRICE_LABEL = 'One-time purchase';

const TIP_AMOUNTS: Record<string, number> = {
  tip_1: 1,
  tip_3: 3,
  tip_5: 5,
};

interface ProState {
  isPro: boolean;
  loading: boolean;
  totalTips: number;
  proPrice: string;
  iapReady: boolean;
}

interface ProContextValue extends ProState {
  unlock: () => Promise<void>;
  restore: () => Promise<void>;
  addTip: (amount: number) => Promise<void>;
  checkFeature: (feature: ProFeature) => boolean;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  loading: true,
  totalTips: 0,
  proPrice: PRO_PRICE_FALLBACK,
  iapReady: false,
  unlock: async () => {},
  restore: async () => {},
  addTip: async () => {},
  checkFeature: () => false,
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProState>({
    isPro: false,
    loading: true,
    totalTips: 0,
    proPrice: PRO_PRICE_FALLBACK,
    iapReady: false,
  });

  const purchaseUpdateSub = useRef<{ remove(): void } | null>(null);
  const purchaseErrorSub = useRef<{ remove(): void } | null>(null);

  // ── Bootstrap: load local state + init IAP connection ──
  useEffect(() => {
    let mounted = true;

    (async () => {
      const [proRaw, tipRaw] = await Promise.all([
        AsyncStorage.getItem(PRO_KEY),
        AsyncStorage.getItem(TIP_KEY),
      ]);

      if (mounted) {
        setState((s) => ({
          ...s,
          isPro: proRaw === 'true',
          loading: false,
          totalTips: tipRaw ? parseFloat(tipRaw) : 0,
        }));
      }

      if (!IAP) {
        if (mounted) setState((s) => ({ ...s, iapReady: true }));
        return;
      }

      try {
        await IAP.initConnection();
        const products = await IAP.fetchProducts({ skus: ALL_SKUS });
        const proProduct = products?.find((p: any) => p.id === PRO_SKU);

        if (mounted) {
          setState((s) => ({
            ...s,
            iapReady: true,
            proPrice: proProduct?.displayPrice ?? PRO_PRICE_FALLBACK,
          }));
        }
      } catch (err) {
        console.warn('[IAP] init failed:', err);
        if (mounted) setState((s) => ({ ...s, iapReady: true }));
      }
    })();

    return () => { mounted = false; };
  }, []);

  // ── Purchase listeners ──
  useEffect(() => {
    if (!IAP) return;

    purchaseUpdateSub.current = IAP.purchaseUpdatedListener(
      async (purchase: any) => {
        try {
          const sku = purchase.productId;

          if (sku === PRO_SKU) {
            await AsyncStorage.setItem(PRO_KEY, 'true');
            setState((s) => ({ ...s, isPro: true }));
            Alert.alert('Welcome to Pro!', 'All features are now unlocked. Thank you!');
          } else if (TIP_AMOUNTS[sku]) {
            const amount = TIP_AMOUNTS[sku];
            const prev = parseFloat((await AsyncStorage.getItem(TIP_KEY)) ?? '0');
            const next = prev + amount;
            await AsyncStorage.setItem(TIP_KEY, next.toString());
            setState((s) => ({ ...s, totalTips: next }));
            Alert.alert('Thank you!', `Your $${amount} tip means a lot. ❤️`);
          }

          await IAP!.finishTransaction({ purchase, isConsumable: sku !== PRO_SKU });
        } catch (err) {
          console.warn('[IAP] finish error:', err);
        }
      },
    );

    purchaseErrorSub.current = IAP.purchaseErrorListener((error: any) => {
      if (error.code !== IAP!.ErrorCode.UserCancelled) {
        Alert.alert('Purchase failed', error.message ?? 'Something went wrong. Please try again.');
      }
    });

    return () => {
      purchaseUpdateSub.current?.remove();
      purchaseErrorSub.current?.remove();
      IAP?.endConnection();
    };
  }, []);

  // ── Actions ──
  const unlock = useCallback(async () => {
    if (!IAP) {
      Alert.alert('Not available', 'Purchases are not available in this build.');
      return;
    }
    try {
      await IAP.requestPurchase({
        request: { android: { skus: [PRO_SKU] } },
        type: 'in-app',
      });
    } catch (err: any) {
      if (err?.code !== IAP.ErrorCode.UserCancelled) {
        Alert.alert('Purchase error', 'Could not start the purchase. Please try again.');
      }
    }
  }, []);

  const restore = useCallback(async () => {
    if (!IAP) {
      Alert.alert('Not available', 'Purchases are not available in this build.');
      return;
    }
    try {
      const purchases = await IAP.getAvailablePurchases();
      const hasPro = purchases?.some((p: any) => p.productId === PRO_SKU);
      if (hasPro) {
        await AsyncStorage.setItem(PRO_KEY, 'true');
        setState((s) => ({ ...s, isPro: true }));
        Alert.alert('Restored', 'Pro has been restored successfully.');
      } else {
        Alert.alert('Nothing to restore', 'No previous Pro purchase was found on this account.');
      }
    } catch {
      Alert.alert('Restore failed', 'Could not check previous purchases. Please try again.');
    }
  }, []);

  const addTip = useCallback(async (amount: number) => {
    if (!IAP) {
      Alert.alert('Not available', 'Purchases are not available in this build.');
      return;
    }
    const sku = `tip_${amount}`;
    if (!TIP_SKUS.includes(sku)) return;
    try {
      await IAP.requestPurchase({
        request: { android: { skus: [sku] } },
        type: 'in-app',
      });
    } catch (err: any) {
      if (err?.code !== IAP.ErrorCode.UserCancelled) {
        Alert.alert('Tip failed', 'Could not process the tip. Please try again.');
      }
    }
  }, []);

  const checkFeature = useCallback(
    (_feature: ProFeature) => state.isPro,
    [state.isPro],
  );

  return (
    <ProContext.Provider value={{ ...state, unlock, restore, addTip, checkFeature }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
