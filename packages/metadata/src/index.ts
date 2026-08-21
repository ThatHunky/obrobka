export {
  readMetadata, readOrientation, hasMetadata, EMPTY_METADATA,
  type Metadata, type CameraInfo, type ShotInfo, type GpsPosition,
} from './read.js';
export { stripMetadata } from './strip.js';
export { buildExifApp1, withExif, type ExifSpec } from './exif-writer.js';
