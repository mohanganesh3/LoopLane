/**
 * Redux Store Configuration
 * Combines all slices and configures persistence
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Uses localStorage

// Import slices
import authReducer from './slices/authSlice';
import ridesReducer from './slices/ridesSlice';
import bookingsReducer from './slices/bookingsSlice';
import uiReducer from './slices/uiSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth', 'ui'] // Only persist auth and ui state
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  rides: ridesReducer,
  bookings: bookingsReducer,
  ui: uiReducer
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      }
    }),
  devTools: import.meta.env.MODE !== 'production'
});

// Create persistor
export const persistor = persistStore(store);

// Export types for TypeScript (if needed later)
export default store;
