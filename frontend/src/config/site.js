// The public APX website, linked from the login pages and both portals.
export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || 'https://apxintl.net').replace(/\/$/, '')
export const WEBSITE_LABEL = WEBSITE_URL.replace(/^https?:\/\//, '')
