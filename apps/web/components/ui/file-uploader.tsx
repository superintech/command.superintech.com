'use client';

import { useState, useRef } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import {
  Plus,
  X,
  Upload,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileCode,
  FileArchive,
} from 'lucide-react';

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

interface FileUploaderProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string;
  className?: string;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return FileImage;
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return FileSpreadsheet;
  if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return FileArchive;
  if (type.includes('code') || type.includes('javascript') || type.includes('json')) return FileCode;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function FilePreview({ uploadedFile, onRemove }: { uploadedFile: UploadedFile; onRemove: () => void }) {
  const { file, preview, uploading, progress, error } = uploadedFile;
  const FileIcon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');

  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-lg border bg-gray-50 p-3',
      error && 'border-red-300 bg-red-50',
      uploading && 'opacity-70'
    )}>
      {/* Preview/Icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white border">
        {isImage && preview ? (
          <img src={preview} alt={file.name} className="h-full w-full rounded-lg object-cover" />
        ) : (
          <FileIcon className="h-6 w-6 text-gray-400" />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {uploading && typeof progress === 'number' && (
          <div className="mt-1 h-1 w-full rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Remove button */}
      {!uploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 shrink-0 hover:bg-red-100"
        >
          <X className="h-4 w-4 text-red-500" />
        </Button>
      )}
    </div>
  );
}

export function FileUploader({
  files,
  onChange,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  accept,
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: UploadedFile[] = [];
    const remainingSlots = maxFiles - files.length;

    for (let i = 0; i < Math.min(fileList.length, remainingSlots); i++) {
      const file = fileList[i];

      // Check file size
      if (file.size > maxSize) {
        newFiles.push({
          id: generateId(),
          file,
          error: `File too large. Max size is ${formatFileSize(maxSize)}`,
        });
        continue;
      }

      const uploadedFile: UploadedFile = {
        id: generateId(),
        file,
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        uploadedFile.preview = URL.createObjectURL(file);
      }

      newFiles.push(uploadedFile);
    }

    onChange([...files, ...newFiles]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    onChange(files.filter(f => f.id !== id));
  };

  const canAddMore = files.length < maxFiles;

  return (
    <div className={cn('space-y-3', className)}>
      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uploadedFile) => (
            <FilePreview
              key={uploadedFile.id}
              uploadedFile={uploadedFile}
              onRemove={() => removeFile(uploadedFile.id)}
            />
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400',
            files.length > 0 && 'p-4'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            onChange={handleInputChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />

          {files.length === 0 ? (
            <>
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 text-center">
                <span className="font-medium text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Max {maxFiles} files, up to {formatFileSize(maxSize)} each
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Plus className="h-4 w-4" />
              <span>Add more files ({files.length}/{maxFiles})</span>
            </div>
          )}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-gray-500 text-center">
          Maximum {maxFiles} files reached
        </p>
      )}
    </div>
  );
}
