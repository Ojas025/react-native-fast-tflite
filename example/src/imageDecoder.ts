import { NativeModules } from 'react-native'

interface NativeBlobPayload {
  blobId: string
  offset: number
  size: number
  type?: string
}

interface NativeDecodedImagePayload {
  width: number
  height: number
  rgbBlob: NativeBlobPayload
}

export interface DecodedImagePayload {
  width: number
  height: number
  rgbBytes: ArrayBuffer
}

interface NativeImageDecoderSpec {
  decodeImage(
    path: string,
    maxDimension: number
  ): Promise<NativeDecodedImagePayload>
}

const NativeImageDecoder = NativeModules.ImageDecoder as
  | NativeImageDecoderSpec
  | undefined

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BlobManager = require(
  'react-native/Libraries/Blob/BlobManager'
) as {
  createFromOptions: (options: NativeBlobPayload) => any
}

/**
 * Fast native blob -> ArrayBuffer transfer.
 * Uses RN FileReader polyfill (required for current RN versions).
 */
function blobToArrayBuffer(
  options: NativeBlobPayload
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const blob = BlobManager.createFromOptions(options)
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result as ArrayBuffer
      blob.close()
      resolve(result)
    }

    reader.onerror = () => {
      blob.close()
      reject(new Error('Failed to read native RGB blob.'))
    }

    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Decodes image natively and returns RGB ArrayBuffer.
 * Assumes modern native implementation returning rgbBlob.
 */
export async function decodeImageToArrayBuffer(
  path: string,
  maxDimension: number
): Promise<DecodedImagePayload> {
  if (!NativeImageDecoder) {
    throw new Error('Native ImageDecoder module unavailable.')
  }

  const decoded = await NativeImageDecoder.decodeImage(
    path,
    maxDimension
  )

  if (!decoded?.rgbBlob?.blobId) {
    throw new Error(
      'Native decoder did not return rgbBlob. Rebuild native app.'
    )
  }

  const buffer = await blobToArrayBuffer(decoded.rgbBlob)

  return {
    width: decoded.width,
    height: decoded.height,
    rgbBytes: buffer,
  }
}
