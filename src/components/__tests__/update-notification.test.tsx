import { render, waitFor, act } from '@testing-library/react';
import { UpdateNotification } from '../update-notification';
import { setCookieWithMinutes, getCookie, deleteCookie } from '@/lib/cookie-utils'; 

// Mock the useToast hook with actual implementation
const mockToast = jest.fn();
const mockDismiss = jest.fn();

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    dismiss: mockDismiss,
  }),
}));

// Mock fetch for version checking
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Mock cookie utilities
jest.mock('@/lib/cookie-utils', () => {
  let cookieStore: Record<string, string> = {};
  
  return {
    setCookieWithMinutes: jest.fn((name: string, value: string, minutes: number) => {
      const expiration = new Date();
      expiration.setTime(expiration.getTime() + minutes * 60 * 1000);
      cookieStore[name] = `${value};expires=${expiration.toUTCString()}`;
    }),
    getCookie: jest.fn((name: string) => {
      const cookie = cookieStore[name];
      if (!cookie) return null;
      
      // Check if cookie is expired
      const [value, expires] = cookie.split(';expires=');
      if (expires && new Date(expires) < new Date()) {
        delete cookieStore[name];
        return null;
      }
      return value;
    }),
    deleteCookie: jest.fn((name: string) => {
      delete cookieStore[name];
    }),
  };
});

describe('UpdateNotification Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset cookies
    const { deleteCookie } = require('@/lib/cookie-utils');
    deleteCookie('update_dismissed');
    
    // Setup fetch mock
    mockFetch.mockResolvedValue({
      json: async () => ({ version: '1.0.3', date: '2025-08-10' }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Version checking', () => {
    it('should check for updates when component mounts', async () => {
      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/version.json');
      });
    });

    it('should show notification when new version is available', async () => {
      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Nueva versión disponible',
            description: 'Actualiza para obtener las últimas mejoras',
          })
        );
      });
    });

    it('should not show notification when versions match', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ version: '1.0.2', date: '2025-08-10' }),
      });

      render(<UpdateNotification currentVersion="1.0.2" />);
      
      // Wait for fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      
      // Should not show notification
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  describe('Cookie handling', () => {
    it('should not show notification if cookie exists and not expired', async () => {
      const { getCookie } = require('@/lib/cookie-utils');
      (getCookie as jest.Mock).mockReturnValue('true');

      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should show notification if cookie is expired', async () => {
      const { getCookie } = require('@/lib/cookie-utils');
      (getCookie as jest.Mock).mockReturnValue(null); // Expired

      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });
  });

  describe('Dismissal behavior', () => {
    it('should set cookie when notification is dismissed', async () => {
      const { setCookieWithMinutes } = require('@/lib/cookie-utils');
      
      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // Simulate dismissal
      const toastCall = mockToast.mock.calls[0][0];
      const closeAction = toastCall.action;
      
      act(() => {
        closeAction.props.onClick();
      });
      
      expect(setCookieWithMinutes).toHaveBeenCalledWith('update_dismissed', 'true', 30);
      expect(mockDismiss).toHaveBeenCalled();
    });

    it('should reload page when update is clicked', async () => {
      const reloadSpy = jest.spyOn(window.location, 'reload');
      
      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // Simulate update click
      const toastCall = mockToast.mock.calls[0][0];
      const updateAction = toastCall.action;
      
      act(() => {
        updateAction.props.onClick();
      });
      
      expect(reloadSpy).toHaveBeenCalled();
      
      reloadSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<UpdateNotification currentVersion="1.0.2" />);
      
      // Should not crash or show notification on error
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should handle invalid version.json format', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ invalid: 'format' }),
      });

      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  describe('30-minute expiration', () => {
    it('should show notification again after 30 minutes', async () => {
      const { setCookieWithMinutes, getCookie } = require('@/lib/cookie-utils');
      
      render(<UpdateNotification currentVersion="1.0.2" />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // Simulate dismissal
      const toastCall = mockToast.mock.calls[0][0];
      const closeAction = toastCall.action;
      
      act(() => {
        closeAction.props.onClick();
      });

      // Advance time by 31 minutes
      act(() => {
        jest.advanceTimersByTime(31 * 60 * 1000);
      });

      // Reset mocks to test second render
      mockToast.mockClear();
      
      // Re-render component
      render(<UpdateNotification currentVersion="1.0.2" />);
      
      // Cookie should be expired
      (getCookie as jest.Mock).mockReturnValue(null);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });
  });
});