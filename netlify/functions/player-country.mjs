/* Return only the approximate country of the current Netlify visitor.
   Never return or store the visitor's full IP address. */
export default async function handler(_request, context) {
  const raw = context?.geo?.country?.code;
  const code = typeof raw === 'string' ? raw.toUpperCase() : '';
  const country = /^[A-Z]{2}$/.test(code) ? code : null;
  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
