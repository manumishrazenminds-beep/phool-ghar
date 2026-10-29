import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { CartProvider } from './lib/cart'
import { WishlistProvider } from './lib/wishlist'
import { CustomerProviders } from './routes.customer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <CustomerProviders>
          <WishlistProvider>
            <App />
          </WishlistProvider>
        </CustomerProviders>
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
)
