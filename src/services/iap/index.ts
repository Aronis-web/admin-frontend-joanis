import {
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestPurchase,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  Product,
  Purchase,
  PurchaseError,
  Subscription,
} from 'react-native-iap';

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
}

export interface IAPPurchase {
  productId: string;
  transactionId: string;
  transactionDate: number;
  transactionReceipt: string;
}

class IAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;

  async initialize(): Promise<void> {
    try {
      await initConnection();
      console.log('IAP connection initialized');
      this.setupListeners();
    } catch (error) {
      console.error('Error initializing IAP:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }
      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }
      await endConnection();
      console.log('IAP connection ended');
    } catch (error) {
      console.error('Error cleaning up IAP:', error);
    }
  }

  private setupListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        console.log('Purchase updated:', purchase);
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          // Send receipt to backend for verification
          try {
            // TODO: Implement backend verification
            await this.verifyPurchase(purchase);
            await finishTransaction({ purchase });
          } catch (error) {
            console.error('Error verifying purchase:', error);
          }
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      console.error('Purchase error:', error);
    });
  }

  async getAvailableProducts(productIds: string[]): Promise<Product[]> {
    try {
      const products = await getProducts({ skus: productIds });
      return products;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  async getAvailableSubscriptions(subscriptionIds: string[]): Promise<Subscription[]> {
    try {
      const subscriptions = await getSubscriptions({ skus: subscriptionIds });
      return subscriptions;
    } catch (error) {
      console.error('Error getting subscriptions:', error);
      throw error;
    }
  }

  async purchaseProduct(productId: string): Promise<void> {
    try {
      await requestPurchase({ sku: productId });
    } catch (error) {
      console.error('Error purchasing product:', error);
      throw error;
    }
  }

  async purchaseSubscription(subscriptionId: string): Promise<void> {
    try {
      await requestSubscription({ sku: subscriptionId });
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      throw error;
    }
  }

  private async verifyPurchase(purchase: Purchase): Promise<void> {
    // TODO: Implement backend verification
    // This should send the receipt to your backend for verification
    // await apiClient.post('/iap/verify', {
    //   receipt: purchase.transactionReceipt,
    //   productId: purchase.productId,
    //   platform: Platform.OS,
    // });
    console.log('Purchase verified:', purchase.productId);
  }

  async restorePurchases(): Promise<void> {
    try {
      // TODO: Implement restore purchases
      // const purchases = await getAvailablePurchases();
      // for (const purchase of purchases) {
      //   await this.verifyPurchase(purchase);
      // }
      console.log('Purchases restored');
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  }
}

export const iapService = new IAPService();
export default iapService;
