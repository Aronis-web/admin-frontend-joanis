import { useState, useEffect } from 'react';
import { filesApi } from '@/services/api';

interface UseSignedUrlOptions {
  enabled?: boolean;
  expiresIn?: number;
}

export const useSignedUrl = (key: string | null, options: UseSignedUrlOptions = {}) => {
  const { enabled = true, expiresIn = 3600 } = options;
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key || !enabled) {
      setUrl(null);
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await filesApi.getSignedUrl(key, expiresIn);
        setUrl(response.url);
      } catch (err: any) {
        console.error('Error fetching signed URL:', err);
        setError(err.response?.data?.message || 'Failed to fetch signed URL');
        setUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSignedUrl();
  }, [key, enabled, expiresIn]);

  const refetch = async () => {
    if (!key) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await filesApi.getSignedUrl(key, expiresIn);
      setUrl(response.url);
    } catch (err: any) {
      console.error('Error fetching signed URL:', err);
      setError(err.response?.data?.message || 'Failed to fetch signed URL');
      setUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    url,
    isLoading,
    error,
    refetch,
  };
};

export default useSignedUrl;
