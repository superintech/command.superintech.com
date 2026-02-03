'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Download,
  Lock,
  Loader2,
  AlertCircle,
  File,
  Image as ImageIcon,
  FileVideo,
  FileAudio,
  FileArchive,
  Clock,
  CheckCircle,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ShareInfo {
  fileName: string;
  fileSize: number;
  mimeType: string;
  requiresPassword: boolean;
  expiresAt: string | null;
  downloadCount: number;
  maxDownloads: number | null;
}

// File type icons
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-16 w-16 text-green-500" />;
  if (mimeType.startsWith('video/')) return <FileVideo className="h-16 w-16 text-purple-500" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="h-16 w-16 text-pink-500" />;
  if (mimeType.includes('pdf')) return <FileText className="h-16 w-16 text-red-500" />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar'))
    return <FileArchive className="h-16 w-16 text-yellow-500" />;
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <FileText className="h-16 w-16 text-blue-500" />;
  return <File className="h-16 w-16 text-gray-500" />;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function SharePage() {
  const params = useParams();
  const code = params.code as string;

  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Fetch share info
  useEffect(() => {
    async function fetchShareInfo() {
      try {
        const response = await fetch(`${API_BASE_URL}/s/${code}/info`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Share link not found');
          return;
        }

        setShareInfo(data.data);
      } catch (err) {
        setError('Failed to load share information');
      } finally {
        setLoading(false);
      }
    }

    if (code) {
      fetchShareInfo();
    }
  }, [code]);

  const handleDownload = async () => {
    if (!shareInfo) return;

    setDownloading(true);
    setDownloadError(null);

    try {
      // Build download URL with password if needed
      let downloadUrl = `${API_BASE_URL}/s/${code}`;
      if (shareInfo.requiresPassword && password) {
        downloadUrl += `?password=${encodeURIComponent(password)}`;
      }

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        const data = await response.json();
        setDownloadError(data.error || 'Download failed');
        return;
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = shareInfo.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
    } catch (err) {
      setDownloadError('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-gray-600">Loading share information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Link Not Available</h2>
            <p className="mt-2 text-center text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state after download
  if (downloadSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Download Started!</h2>
            <p className="mt-2 text-center text-gray-600">
              Your file <strong>{shareInfo?.fileName}</strong> is downloading.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => setDownloadSuccess(false)}
            >
              Download Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main share page
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Shared File</CardTitle>
          <CardDescription>
            Someone shared a file with you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Info */}
          <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg">
            {getFileIcon(shareInfo!.mimeType)}
            <h3 className="mt-4 font-semibold text-lg text-center break-all">
              {shareInfo!.fileName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatFileSize(shareInfo!.fileSize)}
            </p>
          </div>

          {/* Share Details */}
          <div className="space-y-2 text-sm">
            {shareInfo!.expiresAt && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  Expires: {new Date(shareInfo!.expiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            {shareInfo!.maxDownloads && (
              <div className="flex items-center gap-2 text-gray-600">
                <Download className="h-4 w-4" />
                <span>
                  Downloads: {shareInfo!.downloadCount} / {shareInfo!.maxDownloads}
                </span>
              </div>
            )}
            {shareInfo!.requiresPassword && (
              <div className="flex items-center gap-2 text-amber-600">
                <Lock className="h-4 w-4" />
                <span>Password protected</span>
              </div>
            )}
          </div>

          {/* Password Input */}
          {shareInfo!.requiresPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">Enter Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter the password to download"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
              />
            </div>
          )}

          {/* Download Error */}
          {downloadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Download Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleDownload}
            disabled={downloading || (shareInfo!.requiresPassword && !password)}
          >
            {downloading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Download File
              </>
            )}
          </Button>

          {/* Footer */}
          <p className="text-xs text-center text-gray-400">
            Shared via SIT PMS
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
