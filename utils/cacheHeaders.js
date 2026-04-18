/**
 * HTTP cache header helpers for reducing bandwidth and improving response times.
 *
 * Usage:
 *   res = setCacheControl(res, 'public', 300)  // 5-minute public cache
 *   res = setCacheControl(res, 'private', 60)  // 1-minute private cache
 */

const setCacheControl = (res, type = 'private', maxAgeSeconds = 300) => {
  res.set('Cache-Control', `${type}, max-age=${maxAgeSeconds}, must-revalidate`);
  return res;
};

module.exports = {
  setCacheControl,
};
