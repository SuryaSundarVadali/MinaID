# UIDAI Certificates

This directory should contain UIDAI public certificates for verifying Aadhar XML digital signatures.

## Required Certificates

Download the following certificates from UIDAI official website:

### 1. Latest Certificate (2023)
- **URL**: https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod_2023.cer
- **Filename**: `uidai_auth_sign_prod_2023.cer`
- **For**: Aadhar XML files downloaded after June 7, 2020

### 2. Legacy Certificate (2020)
- **URL**: https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod.cer
- **Filename**: `uidai_auth_sign_prod_2020.cer`
- **For**: Aadhar XML files downloaded between June 18, 2019 and June 7, 2020

### 3. Old Certificate (2019)
- **URL**: https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod.cer
- **Filename**: `uidai_auth_sign_prod_2019.cer`
- **For**: Aadhar XML files downloaded before June 18, 2019

## How to Download

You can download these certificates using:

### Method 1: Using curl
```bash
# Download 2023 certificate
curl -k -o uidai_auth_sign_prod_2023.cer https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod_2023.cer

# Download 2020 certificate
curl -k -o uidai_auth_sign_prod_2020.cer https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod.cer
```

### Method 2: Using wget
```bash
# Download 2023 certificate
wget --no-check-certificate -O uidai_auth_sign_prod_2023.cer https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod_2023.cer

# Download 2020 certificate
wget --no-check-certificate -O uidai_auth_sign_prod_2020.cer https://uidai.gov.in/images/authDoc/uidai_auth_sign_prod.cer
```

### Method 3: Manual Download
1. Visit https://uidai.gov.in/
2. Navigate to Ecosystem > Authentication Devices & Documents
3. Download the certificates from the links provided
4. Save them in this directory with the appropriate filenames

## Security Note

⚠️ **Important**: Always verify that you're downloading certificates from the official UIDAI website (https://uidai.gov.in/) to ensure authenticity.

## Certificate Format

The certificates are in X.509 DER format (`.cer`). The parser will automatically handle the conversion to PEM format when needed.

## Fallback Behavior

If certificates are not available locally, the parser will:
1. Attempt to verify using certificates embedded in the XML (KeyInfo/X509Data)
2. Log a warning if verification cannot be performed
3. Still extract demographic data but mark signature as unverified

For production use, it is **strongly recommended** to have the certificates available locally for proper signature verification.
