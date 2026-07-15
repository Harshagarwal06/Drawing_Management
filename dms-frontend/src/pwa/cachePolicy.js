export const PRIVATE_REQUEST_PATTERN = /(?:\/api(?:\/|$)|\/uploads(?:\/|$)|\.(?:pdf|dwg|dxf|ifc|rvt)(?:$|[?#])|(?:X-Amz-(?:Signature|Credential)|[?&](?:token|signature)=))/i;

export function isPrivateResourceUrl(input) {
  const value = input instanceof URL ? input.href : String(input ?? "");
  return PRIVATE_REQUEST_PATTERN.test(value);
}

