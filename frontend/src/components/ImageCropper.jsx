import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const ImageCropper = ({ imageSrc, onCrop, onCancel, targetSize = 128 }) => {
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
        const containerWidth = containerRef.current.clientWidth - 40; // padding
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
    if (canvasRef.current && imageRef.current && imageSize.width > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = imageSize.width;
      canvas.height = imageSize.height;

      // Draw image
      ctx.drawImage(imageRef.current, 0, 0, imageSize.width, imageSize.height);

      // Draw overlay (darken outside crop area)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, imageSize.width, imageSize.height);
      ctx.clearRect(crop.x, crop.y, crop.size, crop.size);

      // Draw crop border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.size, crop.size);

      // Draw corner handles
      const handleSize = 8;
      ctx.fillStyle = '#3b82f6';
      const corners = [
        [crop.x, crop.y],
        [crop.x + crop.size, crop.y],
        [crop.x, crop.y + crop.size],
        [crop.x + crop.size, crop.y + crop.size]
      ];
      corners.forEach(([x, y]) => {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      });
    }
  }, [imageSize, crop]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a corner handle
    const handleSize = 8;
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
      setDragStart({ x, y, corner: 'move', cropX: crop.x, cropY: crop.y });
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

  const handleCrop = () => {
    if (!imageRef.current || !canvasRef.current) return;

    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = targetSize;
    cropCanvas.height = targetSize;
    const cropCtx = cropCanvas.getContext('2d');

    // Calculate source coordinates (scale back to original image)
    const scaleX = imageRef.current.width / imageSize.width;
    const scaleY = imageRef.current.height / imageSize.height;
    const sourceX = crop.x * scaleX;
    const sourceY = crop.y * scaleY;
    const sourceSize = crop.size * Math.min(scaleX, scaleY);

    // Draw cropped and resized image
    cropCtx.drawImage(
      imageRef.current,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, targetSize, targetSize
    );

    // Convert to base64
    const croppedImage = cropCanvas.toDataURL('image/png');
    onCrop(croppedImage);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Crop Image (128x128, 1:1 ratio)</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mb-4 p-4 bg-gray-800 rounded border border-gray-700 flex justify-center" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="cursor-move"
            style={{ maxWidth: '100%', height: 'auto' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleCrop}>Crop to 128x128</Button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;

