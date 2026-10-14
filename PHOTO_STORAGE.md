# Catch photo storage

Catch photos are stored on the API machine, outside the frontend. By default the API uses its `uploads/` directory (ignored by Git). To pick a different directory, set this in the API's `.env` and restart it:

```dotenv
PHOTO_STORAGE_PATH=/absolute/path/to/anglers-photos
```

The API process must have permission to create files in that directory. It creates a `catches/` subdirectory on the first upload. The database's existing `fish_image` column stores a relative key, such as `catches/<generated-uuid>.jpg`; no schema migration is needed. Move the files and change `PHOTO_STORAGE_PATH` when moving servers. Back up the photo directory and PostgreSQL together.

Install backend dependencies with `npm install`, then restart the API. No AWS SDK or credentials are used. Remove obsolete `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` entries from local/server environment settings if present. Existing S3 images are not downloaded automatically; use the catch details page to upload a local replacement. Existing award decisions remain until the catch is edited; external URLs cannot qualify new submissions.

If using Docker, mount persistent host storage and configure the container path:

```yaml
services:
  api:
    environment:
      PHOTO_STORAGE_PATH: /data/photos
    volumes:
      - /path/on/home-server/anglers-photos:/data/photos
```

## API

- `POST /fishcatch`: accepts existing JSON fields, or multipart fields with an optional `photo` file. Encode `new_trip` as JSON in multipart requests. A failed catch save removes the newly stored photo.
- `POST /fishcatch/:catch_id/photo`: multipart `photo`, adds/replaces the catch photo.
- `DELETE /fishcatch/:catch_id/photo`: removes the catch photo.
- `GET /fishcatch/:catch_id/photo`: returns JPEG bytes.

All photo routes require bearer authentication and catch ownership or admin access. The frontend fetches the image with that header, then supplies a temporary browser blob URL to `<img>`; tokens never appear in image URLs. Photo responses are private and not cached.

Uploads accept one JPEG, PNG, WebP, or HEIC/HEIF up to 10 MB and 40 megapixels. The API decodes the actual image, applies orientation, resizes to fit 2000×2000 without enlargement, re-encodes as JPEG, and strips EXIF metadata. It generates filenames and does not accept client-supplied filesystem paths or photo URLs.

Master Angler eligibility still requires the species length threshold and a valid witness, plus an uploaded local photo. Replacing/removing an approved catch's photo clears approval and recalculates eligibility for another review. Denied decisions remain denied under the existing review policy. Certificates embed local photos; an unavailable stored file causes certificate generation to fail rather than silently omit evidence.

HEIC/HEIF photos are decoded on the server using libheif-js in a worker thread, then resized and saved as JPEG. The primary photograph is selected when the container contains auxiliary images. Decoding has a 20-second timeout and a limit of two simultaneous HEIC jobs; busy requests can be retried. The 10 MB and 40 megapixel limits also apply to HEIC. Browsers that cannot preview HEIC show the selected filename until the saved JPEG is available. No extra system image libraries are required.
