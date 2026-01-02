import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const InlineImageCropper = ({ imageSrc, onCrop, onRemove, onCancel, targetSize = 128 }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (imageSrc && containerRef.current) {
      const img = new Image();
      img.onload = () => {
        const containerWidth = 400; // Fixed width for preview
        const scale = Math.min(containerWidth / img.width, containerWidth / img.height, 1);
        const displayWidth = img.width * scale;
        const displayHeight = img.height * scale;
        setImageSize({ width: displayWidth, height: displayHeight });
        
        // Initialize crop to center, 1:1 aspect ratio
        const initialSize = Math.min(displayWidth, displayHeight);
        setCrop({
          x: (displayWidth - initialSize) / 2,
          y: (displayHeight - initialSize) / 2,
          size: initialSize
        });
      };
      img.src = imageSrc;
      imageRef.current = img;
    }
  }, [imageSrc]);

  useEffect(() => {
    if (canvasRef.current && imageRef.current && imageSize.width > 0 && crop.size > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = imageSize.width;
      canvas.height = imageSize.height;

      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.drawImage(imageRef.current, 0, 0, imageSize.width, imageSize.height);

      // Draw overlay outside crop area only (draw in 4 rectangles: top, bottom, left, right)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      
      // Top rectangle
      if (crop.y > 0) {
        ctx.fillRect(0, 0, imageSize.width, crop.y);
      }
      
      // Bottom rectangle
      if (crop.y + crop.size < imageSize.height) {
        ctx.fillRect(0, crop.y + crop.size, imageSize.width, imageSize.height - (crop.y + crop.size));
      }
      
      // Left rectangle
      if (crop.x > 0) {
        ctx.fillRect(0, crop.y, crop.x, crop.size);
      }
      
      // Right rectangle
      if (crop.x + crop.size < imageSize.width) {
        ctx.fillRect(crop.x + crop.size, crop.y, imageSize.width - (crop.x + crop.size), crop.size);
      }

      // Draw crop border with thicker line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(crop.x, crop.y, crop.size, crop.size);

      // Draw corner handles (larger and more visible)
      const handleSize = 12;
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const corners = [
        [crop.x, crop.y],
        [crop.x + crop.size, crop.y],
        [crop.x, crop.y + crop.size],
        [crop.x + crop.size, crop.y + crop.size]
      ];
      corners.forEach(([x, y]) => {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      });
    }
  }, [imageSize, crop]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    if (!canvasRef.current || crop.size <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a corner handle (larger hit area)
    const handleSize = 15;
    const corners = [
      { x: crop.x, y: crop.y, type: 'top-left' },
      { x: crop.x + crop.size, y: crop.y, type: 'top-right' },
      { x: crop.x, y: crop.y + crop.size, type: 'bottom-left' },
      { x: crop.x + crop.size, y: crop.y + crop.size, type: 'bottom-right' }
    ];

    let corner = null;
    for (const c of corners) {
      if (Math.abs(x - c.x) < handleSize && Math.abs(y - c.y) < handleSize) {
        corner = c.type;
        break;
      }
    }

    if (corner) {
      setIsDragging(true);
      setDragStart({ x, y, corner, cropX: crop.x, cropY: crop.y, cropSize: crop.size });
    } else if (x >= crop.x && x <= crop.x + crop.size && y >= crop.y && y <= crop.y + crop.size) {
      // Dragging the entire crop area
      setIsDragging(true);
      setDragStart({ x, y, corner: 'move', cropX: crop.x, cropY: crop.y, cropSize: crop.size });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;

    if (dragStart.corner === 'move') {
      // Move the entire crop area
      const newX = Math.max(0, Math.min(imageSize.width - dragStart.cropSize, dragStart.cropX + deltaX));
      const newY = Math.max(0, Math.min(imageSize.height - dragStart.cropSize, dragStart.cropY + deltaY));
      setCrop({ ...crop, x: newX, y: newY, size: dragStart.cropSize });
    } else {
      // Resize from corner
      let newX = dragStart.cropX;
      let newY = dragStart.cropY;
      let newSize = dragStart.cropSize;

      if (dragStart.corner.includes('right')) {
        newSize = Math.min(imageSize.width - newX, dragStart.cropSize + deltaX);
      }
      if (dragStart.corner.includes('bottom')) {
        newSize = Math.min(imageSize.height - newY, dragStart.cropSize + deltaY);
      }
      if (dragStart.corner.includes('left')) {
        const delta = Math.min(newX, dragStart.cropSize - deltaX);
        newX = dragStart.cropX - (dragStart.cropSize - delta);
        newSize = delta;
      }
      if (dragStart.corner.includes('top')) {
        const delta = Math.min(newY, dragStart.cropSize - deltaY);
        newY = dragStart.cropY - (dragStart.cropSize - delta);
        newSize = Math.min(newSize, delta);
      }

      newSize = Math.max(50, Math.min(newSize, Math.min(imageSize.width - newX, imageSize.height - newY)));
      setCrop({ x: newX, y: newY, size: newSize });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    if (!imageRef.current || crop.size <= 0) {
      console.error('Cannot crop: invalid image or crop area', { imageRef: !!imageRef.current, cropSize: crop.size });
      return;
    }

    try {
      // Create a new canvas for the cropped image
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = targetSize;
      cropCanvas.height = targetSize;
      const cropCtx = cropCanvas.getContext('2d');

      // Calculate source coordinates (scale back to original image dimensions)
      const scaleX = imageRef.current.width / imageSize.width;
      const scaleY = imageRef.current.height / imageSize.height;
      const sourceX = crop.x * scaleX;
      const sourceY = crop.y * scaleY;
      const sourceSize = crop.size * scaleX; // Use scaleX for consistent scaling

      // Ensure source coordinates are within image bounds
      const maxSourceSize = Math.min(imageRef.current.width - sourceX, imageRef.current.height - sourceY);
      const finalSourceSize = Math.min(sourceSize, maxSourceSize);
      
      const finalSourceX = Math.max(0, Math.min(sourceX, imageRef.current.width - finalSourceSize));
      const finalSourceY = Math.max(0, Math.min(sourceY, imageRef.current.height - finalSourceSize));

      // Clear canvas with white background
      cropCtx.fillStyle = '#ffffff';
      cropCtx.fillRect(0, 0, targetSize, targetSize);

      // Draw cropped and resized image
      cropCtx.drawImage(
        imageRef.current,
        finalSourceX, finalSourceY, finalSourceSize, finalSourceSize,
        0, 0, targetSize, targetSize
      );

      // Convert to base64
      const croppedImage = cropCanvas.toDataURL('image/png');
      if (!croppedImage || croppedImage === 'data:,') {
        console.error('Failed to generate cropped image');
        return;
      }
      onCrop(croppedImage);
    } catch (error) {
      console.error('Error applying crop:', error);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="space-y-3 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Crop Image (128x128, 1:1 ratio)</div>
          <div className="text-xs text-muted-foreground">Drag to move, drag corners to resize</div>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-400 hover:text-red-300"
          >
            Remove Image
          </Button>
        )}
      </div>
      
      <div className="flex justify-center p-2 bg-gray-900 rounded border border-gray-700" ref={containerRef}>
        <div className="relative" style={{ width: imageSize.width || 'auto', height: imageSize.height || 'auto' }}>
          <canvas
            ref={canvasRef}
            className="cursor-move block"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else if (onRemove) {
              onRemove();
            }
          }}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleApplyCrop}>
          Apply Crop (128x128)
        </Button>
      </div>
    </div>
  );
};

export default InlineImageCropper;

