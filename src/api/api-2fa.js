import { apiClient } from './apiClient';

export const get2FAStatus  = ()                      => apiClient.get('/auth/me');
export const setup2FA      = ()                      => apiClient.post('/auth/2fa/setup', {});
export const activate2FA   = (secret, code)          => apiClient.post('/auth/2fa/activate', { secret, code });
export const disable2FA    = (code)                  => apiClient.post('/auth/2fa/disable', { code });
export const verify2FALogin = (pendingToken, code)   => apiClient.post('/auth/2fa/verify', { pendingToken, code });
