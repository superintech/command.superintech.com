'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { filesApi, projectsApi, FileAttachment, FileShare } from '@/lib/api';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Share2,
  Search,
  Grid,
  List,
  Image as ImageIcon,
  FileArchive,
  FileVideo,
  FileAudio,
  File,
  Loader2,
  X,
  Copy,
  Check,
  Link,
  Calendar,
  Lock,
  Eye,
  FolderOpen,
  HardDrive,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// File type icons
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-green-400" />;
  if (mimeType.startsWith('video/')) return <FileVideo className="h-8 w-8 text-purple-400" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="h-8 w-8 text-pink-400" />;
  if (mimeType.includes('pdf')) return <FileText className="h-8 w-8 text-red-400" />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('compressed'))
    return <FileArchive className="h-8 w-8 text-yellow-400" />;
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <FileText className="h-8 w-8 text-blue-400" />;
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return <FileText className="h-8 w-8 text-green-400" />;
  return <File className="h-8 w-8 text-slate-400" />;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function FilesPage() {
  const { accessToken, user, hasPermission } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Permission checks
  const canUpload = hasPermission('files.upload');
  const canShare = hasPermission('files.share');
  const canDelete = hasPermission('files.delete');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Preview state
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);

  // Share dialog state
  const [sharingFile, setSharingFile] = useState<FileAttachment | null>(null);
  const [shareOptions, setShareOptions] = useState({
    expiresIn: 7,
    password: '',
    maxDownloads: 0,
  });
  const [createdShare, setCreatedShare] = useState<FileShare | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete confirmation state
  const [deletingFile, setDeletingFile] = useState<FileAttachment | null>(null);

  // Fetch files
  const { data: filesData, isLoading: loadingFiles } = useQuery({
    queryKey: ['files', projectFilter],
    queryFn: () => filesApi.list(accessToken!, projectFilter !== 'all' ? { projectId: projectFilter } : undefined),
    enabled: !!accessToken,
  });

  // Fetch projects for filter
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (projectFilter !== 'all') {
        formData.append('projectId', projectFilter);
      }

      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setUploadingFiles([]);
      toast({ title: 'Files uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(fileId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setDeletingFile(null);
      toast({ title: 'File deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete file', variant: 'destructive' });
    },
  });

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: ({ fileId, options }: { fileId: string; options: { expiresIn?: number; password?: string; maxDownloads?: number } }) =>
      filesApi.createShare(fileId, accessToken!, options),
    onSuccess: (response) => {
      setCreatedShare(response.data);
      toast({ title: 'Share link created' });
    },
    onError: () => {
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    },
  });

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setUploadingFiles(droppedFiles);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setUploadingFiles(selectedFiles);
    }
  };

  const handleUpload = () => {
    if (uploadingFiles.length === 0) return;
    setIsUploading(true);
    uploadMutation.mutate(uploadingFiles);
  };

  const handleCreateShare = () => {
    if (!sharingFile) return;
    createShareMutation.mutate({
      fileId: sharingFile.id,
      options: {
        expiresIn: shareOptions.expiresIn > 0 ? shareOptions.expiresIn : undefined,
        password: shareOptions.password || undefined,
        maxDownloads: shareOptions.maxDownloads > 0 ? shareOptions.maxDownloads : undefined,
      },
    });
  };

  const handleCopyLink = () => {
    if (!createdShare) return;
    const shareUrl = filesApi.getPublicShareUrl(createdShare.code);
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCloseShareDialog = () => {
    setSharingFile(null);
    setCreatedShare(null);
    setShareOptions({ expiresIn: 7, password: '', maxDownloads: 0 });
  };

  const files = filesData?.data || [];
  const projects = projectsData?.data || [];

  // Filter files by search
  const filteredFiles = files.filter(file =>
    file.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const imageCount = files.filter(f => f.mimeType.startsWith('image/')).length;
  const docCount = files.filter(f => f.mimeType.includes('pdf') || f.mimeType.includes('document') || f.mimeType.includes('word')).length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Files' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Files</h1>
          <p className="text-slate-400 mt-1">Project files and documents</p>
        </div>
        {canUpload && (
          <>
            <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-500 hover:bg-blue-600 shadow-sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl">
              <FolderOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{files.length}</p>
              <p className="text-sm text-slate-400">Total Files</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-green-500/20 rounded-xl">
              <HardDrive className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatFileSize(totalSize)}</p>
              <p className="text-sm text-slate-400">Total Size</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 rounded-xl">
              <ImageIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{imageCount}</p>
              <p className="text-sm text-slate-400">Images</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <FileText className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{docCount}</p>
              <p className="text-sm text-slate-400">Documents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Zone */}
      {uploadingFiles.length > 0 && (
        <Card className="bg-[#131d2e] border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white">Ready to Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadingFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#0a1628] rounded border border-slate-700">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.type)}
                    <span className="text-sm font-medium text-white">{file.name}</span>
                    <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadingFiles(files => files.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleUpload} disabled={isUploading} className="bg-blue-500 hover:bg-blue-600">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setUploadingFiles([])} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drag and Drop Zone */}
      {canUpload && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-blue-400' : 'text-slate-500'}`} />
          <p className="text-slate-300 font-medium">
            {isDragging ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            or click the Upload button above
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Max 50MB per file. Supports images, documents, videos, and archives.
          </p>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px] bg-[#131d2e] border-slate-700 text-white">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent className="bg-[#131d2e] border-slate-700">
              <SelectItem value="all" className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">All Projects</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 border border-slate-700 rounded-lg p-1 bg-[#131d2e]">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Files Display */}
      {loadingFiles ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card className="bg-[#131d2e] border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-slate-600" />
            <h3 className="mt-4 text-lg font-medium text-white">No files found</h3>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery ? 'Try a different search term' : 'Upload your first file to get started'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredFiles.map(file => (
            <Card key={file.id} className="bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-all duration-200 hover:-translate-y-0.5 group">
              <CardContent className="p-4">
                {/* Preview or Icon */}
                <div
                  className="aspect-square bg-[#0a1628] rounded-lg flex items-center justify-center mb-3 cursor-pointer overflow-hidden border border-slate-700"
                  onClick={() => file.mimeType.startsWith('image/') && setPreviewFile(file)}
                >
                  {file.mimeType.startsWith('image/') ? (
                    <img
                      src={filesApi.getDownloadUrl(file.id)}
                      alt={file.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getFileIcon(file.mimeType)
                  )}
                </div>

                {/* File Info */}
                <p className="font-medium text-sm text-white truncate" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(filesApi.getDownloadUrl(file.id), '_blank')}
                    title="Download"
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canShare && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSharingFile(file)}
                      title="Share"
                      className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingFile(file)}
                      title="Delete"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-[#131d2e] border-slate-700">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-[#0a1628]">
                  <th className="text-left py-3 px-4 font-medium text-slate-300">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">Size</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">Uploaded</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">By</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map(file => (
                  <tr key={file.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.mimeType)}
                        <span className="font-medium text-white truncate max-w-[200px]" title={file.originalName}>
                          {file.originalName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-300">
                        {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {formatDate(file.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {file.uploader?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {file.mimeType.startsWith('image/') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewFile(file)}
                            title="Preview"
                            className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(filesApi.getDownloadUrl(file.id), '_blank')}
                          title="Download"
                          className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canShare && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSharingFile(file)}
                            title="Share"
                            className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingFile(file)}
                            title="Delete"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl bg-[#131d2e] border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{previewFile?.originalName}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="flex items-center justify-center bg-[#0a1628] rounded-lg p-4">
              <img
                src={filesApi.getDownloadUrl(previewFile.id)}
                alt={previewFile.originalName}
                className="max-h-[70vh] object-contain"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFile(null)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
              Close
            </Button>
            <Button onClick={() => window.open(filesApi.getDownloadUrl(previewFile!.id), '_blank')} className="bg-blue-500 hover:bg-blue-600">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={!!sharingFile} onOpenChange={handleCloseShareDialog}>
        <DialogContent className="bg-[#131d2e] border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Share File</DialogTitle>
          </DialogHeader>
          {sharingFile && !createdShare && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#0a1628] rounded-lg border border-slate-700">
                {getFileIcon(sharingFile.mimeType)}
                <div>
                  <p className="font-medium text-white">{sharingFile.originalName}</p>
                  <p className="text-sm text-slate-400">{formatFileSize(sharingFile.size)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Link expires in (days)</Label>
                <Select
                  value={shareOptions.expiresIn.toString()}
                  onValueChange={(v) => setShareOptions({ ...shareOptions, expiresIn: parseInt(v) })}
                >
                  <SelectTrigger className="bg-[#0a1628] border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131d2e] border-slate-700">
                    <SelectItem value="1" className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">1 day</SelectItem>
                    <SelectItem value="7" className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">7 days</SelectItem>
                    <SelectItem value="30" className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">30 days</SelectItem>
                    <SelectItem value="0" className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Password protection (optional)</Label>
                <Input
                  type="password"
                  placeholder="Enter password..."
                  value={shareOptions.password}
                  onChange={(e) => setShareOptions({ ...shareOptions, password: e.target.value })}
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Max downloads (0 = unlimited)</Label>
                <Input
                  type="number"
                  min="0"
                  value={shareOptions.maxDownloads}
                  onChange={(e) => setShareOptions({ ...shareOptions, maxDownloads: parseInt(e.target.value) || 0 })}
                  className="bg-[#0a1628] border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          {createdShare && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/20 rounded-lg text-center border border-green-500/30">
                <Check className="h-8 w-8 text-green-400 mx-auto" />
                <p className="mt-2 font-medium text-green-400">Share link created!</p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Share URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={filesApi.getPublicShareUrl(createdShare.code)}
                    className="font-mono text-sm bg-[#0a1628] border-slate-700 text-white"
                  />
                  <Button onClick={handleCopyLink} className="bg-blue-500 hover:bg-blue-600">
                    {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-sm text-slate-400">
                {createdShare.expiresAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Expires: {formatDate(createdShare.expiresAt)}
                  </div>
                )}
                {createdShare.password && (
                  <div className="flex items-center gap-1">
                    <Lock className="h-4 w-4" />
                    Password protected
                  </div>
                )}
                {createdShare.maxDownloads && (
                  <div className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    Max {createdShare.maxDownloads} downloads
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseShareDialog} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
              {createdShare ? 'Done' : 'Cancel'}
            </Button>
            {!createdShare && (
              <Button onClick={handleCreateShare} disabled={createShareMutation.isPending} className="bg-blue-500 hover:bg-blue-600">
                {createShareMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Create Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingFile} onOpenChange={() => setDeletingFile(null)}>
        <DialogContent className="bg-[#131d2e] border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete File</DialogTitle>
          </DialogHeader>
          <p className="text-slate-300">
            Are you sure you want to delete <strong className="text-white">{deletingFile?.originalName}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingFile && deleteMutation.mutate(deletingFile.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
