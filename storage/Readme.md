# /storage

Local disk fallback for file storage. Used automatically when the
`STORAGE_*` environment variables (S3/R2 credentials) are missing or
look malformed — see `backend/app/storage_backends.py`.

## Layout

Files are organised the same way they would be as S3/R2 keys, just as
real folders on disk — one subfolder per upload, never dumped flat:

```
storage/
  resumes/
    <candidate_id>/
      v1/
        resume.pdf
        resume.pdf.meta.json
      v2/
        resume_final.pdf
        resume_final.pdf.meta.json
```

Each `*.meta.json` sidecar stores the original filename, content type,
size, and upload timestamp — so files stay identifiable even though the
stored filename on disk is sanitised.

## Switching to real S3/R2

Once `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, and
`STORAGE_BUCKET` are set (and `STORAGE_ENDPOINT_URL` for Cloudflare R2),
the app automatically switches to the real backend on next startup —
no code changes needed, since both backends use the same key scheme.

## Do not commit contents

This folder is gitignored except for this README and `.gitkeep`. Files
here are local dev artifacts, not source — see the root `.gitignore`.