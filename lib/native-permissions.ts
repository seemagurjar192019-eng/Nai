import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface NativeMediaCaptureResult {
  success: boolean;
  base64Data?: string;
  dataUrl?: string;
  format?: string;
  error?: string;
  source: 'native-camera' | 'native-gallery' | 'web-input';
}

/**
 * Checks and requests Camera & Photos permissions natively on Capacitor Android / iOS,
 * with zero-crash browser fallback via standard HTML file input.
 */
export async function captureBillPhoto(options: {
  fromGallery?: boolean;
}): Promise<NativeMediaCaptureResult> {
  const fromGallery = Boolean(options.fromGallery);

  if (Capacitor.isNativePlatform()) {
    try {
      const check = await Camera.checkPermissions();
      if (check.camera !== 'granted' || check.photos !== 'granted') {
        const req = await Camera.requestPermissions({
          permissions: fromGallery ? ['photos'] : ['camera', 'photos'],
        });
        if (
          (!fromGallery && req.camera !== 'granted') ||
          (fromGallery && req.photos !== 'granted')
        ) {
          return {
            success: false,
            error: fromGallery
              ? 'Photo Gallery permission was denied. Enable Photos access in App Settings.'
              : 'Camera permission was denied. Enable Camera access in App Settings.',
            source: fromGallery ? 'native-gallery' : 'native-camera',
          };
        }
      }

      const photo: Photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: fromGallery ? CameraSource.Photos : CameraSource.Camera,
        width: 1600,
        correctOrientation: true,
      });

      if (!photo.base64String) {
        return {
          success: false,
          error: 'No image data captured.',
          source: fromGallery ? 'native-gallery' : 'native-camera',
        };
      }

      const mime = photo.format ? `image/${photo.format}` : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${photo.base64String}`;

      return {
        success: true,
        base64Data: photo.base64String,
        dataUrl,
        format: photo.format,
        source: fromGallery ? 'native-gallery' : 'native-camera',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('user cancelled')) {
        return {
          success: false,
          error: 'User cancelled image selection',
          source: fromGallery ? 'native-gallery' : 'native-camera',
        };
      }
      return {
        success: false,
        error: message || 'Failed to capture photo via native camera.',
        source: fromGallery ? 'native-gallery' : 'native-camera',
      };
    }
  }

  // Web fallback using invisible HTML input
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ success: false, error: 'Document not available.', source: 'web-input' });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (!fromGallery) {
      input.capture = 'environment';
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ success: false, error: 'No file selected.', source: 'web-input' });
        return;
      }

      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const base64Data = dataUrl.split(',')[1] || '';
          resolve({
            success: true,
            dataUrl,
            base64Data,
            format: file.type.split('/')[1] || 'jpeg',
            source: 'web-input',
          });
        };
        reader.onerror = () => {
          resolve({ success: false, error: 'Failed to read image file.', source: 'web-input' });
        };
        reader.readAsDataURL(file);
      } catch (e: unknown) {
        resolve({
          success: false,
          error: e instanceof Error ? e.message : 'Error reading selected file.',
          source: 'web-input',
        });
      }
    };

    input.click();
  });
}

/**
 * Checks and prompts for native microphone permissions.
 */
export async function requestNativeMicrophonePermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, error: 'Audio recording is not supported in this browser environment.' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately after verifying permission so other components have hardware access
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.name : 'NotAllowedError';
    if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
      return {
        granted: false,
        error: 'Microphone permission was denied. Please allow microphone access to use voice ledger.',
      };
    }
    return {
      granted: false,
      error: 'Microphone could not be accessed. Check hardware or device settings.',
    };
  }
}

/**
 * Saves and shares files natively (receipts, statements, backup JSON) via Capacitor Filesystem & Share,
 * falling back to Web Share API or download anchor on desktop/web.
 */
export async function saveAndShareDocument(options: {
  fileName: string;
  content: string; // Plain text or JSON or base64
  isBase64?: boolean;
  mimeType?: string;
  title?: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { fileName, content, isBase64 = false, mimeType = 'text/plain', title = 'Ucred', text = '' } = options;

  if (Capacitor.isNativePlatform()) {
    try {
      const saved = await Filesystem.writeFile({
        path: fileName,
        data: content,
        directory: Directory.Cache,
        encoding: isBase64 ? undefined : Encoding.UTF8,
      });

      await Share.share({
        title,
        text,
        url: saved.uri,
        dialogTitle: `Share ${title}`,
      });

      return { success: true };
    } catch (err: unknown) {
      // If share was cancelled by user, treat as non-fatal
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('cancel')) {
        return { success: true };
      }
      return { success: false, error: msg || 'Failed to save or share document via native system.' };
    }
  }

  // Web Fallback
  try {
    if (navigator.share && !isBase64) {
      await navigator.share({ title, text: text || content });
      return { success: true };
    }

    const blob = isBase64
      ? base64ToBlob(content, mimeType)
      : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Web download/sharing failed.',
    };
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
