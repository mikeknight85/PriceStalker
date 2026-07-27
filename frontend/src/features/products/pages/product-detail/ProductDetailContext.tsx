import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '../../../auth';
import { useProductDetailState } from '../../hooks/useProductDetailState';

type ProductDetailState = ReturnType<typeof useProductDetailState>;

interface ProductDetailContextValue {
  productId: number;
  user: ReturnType<typeof useAuth>['user'];
  state: ProductDetailState;
}

const ProductDetailContext = createContext<ProductDetailContextValue | undefined>(undefined);

export function ProductDetailProvider({ productId, children }: { productId: number; children: ReactNode }) {
  const { user } = useAuth();
  const state = useProductDetailState(productId);

  return (
    <ProductDetailContext.Provider value={{ productId, user, state }}>
      {children}
    </ProductDetailContext.Provider>
  );
}

export function useProductDetail() {
  const context = useContext(ProductDetailContext);
  if (!context) throw new Error('useProductDetail must be used within ProductDetailProvider');
  return context;
}
