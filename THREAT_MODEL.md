# Formal Security Architecture & Threat Model Whitepaper

**System:** Personal Cloud Vault  
**Architecture:** Zero-Knowledge Client-Side Encrypted Secret Manager & Storage  
**Author / Standard:** OWASP & NIST PQC Cryptographic Baseline  
**Version:** 2.0-RESEARCH  

---

## 1. Executive Summary & Security Objectives
Personal Cloud Vault is designed around a strict **Zero-Knowledge Architecture**. Plaintext credentials, documents, notes, and encryption keys exist strictly within the client's transient WebCrypto runtime memory. The backend infrastructure (NeonDB PostgreSQL database and Cloudflare R2 object storage) stores only authenticated ciphertexts, blind index tokens, and cryptographic commitments.

### Core Invariants:
1. **Zero Server Trust:** Server compromise, SQL injection, or database exposure reveals **zero plaintext contents**.
2. **Post-Quantum Resilience:** Dual-layer hybrid key encapsulation (AES-256-GCM + ML-KEM-768/Kyber) protects archived ciphertexts against quantum decryption ("Harvest Now, Decrypt Later").
3. **Tamper-Evident Logs:** Database modifications are bound to a client-verifiable Merkle Hash Tree chain.
4. **Hardware Key Binding:** Hardware authenticators (WebAuthn / FIDO2 PRF) fortify PBKDF2 key derivation.

---

## 2. Attacker Capability Model & STRIDE Analysis

| Threat Vector | STRIDE Category | Attacker Capability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Untrusted DB / Compromised Server Action** | Spoofing / Information Disclosure | Reads PostgreSQL `vault_items` table or Neon database snapshots. | Zero-Knowledge Architecture. All fields encrypted client-side using AES-GCM (256-bit). Server has no access to Master Key. |
| **Database Row Insertion / Modification** | Tampering | DB admin or adversary modifies/deletes rows in NeonDB. | Merkle Hash Tree Audit Log. Client verifies $H_n = \text{SHA256}(H_{n-1} \parallel \text{Payload})$. Any row alteration breaks chain verification. |
| **MITM Network Eavesdropping** | Information Disclosure | Intercepts HTTP requests or S3 presigned URLs in transit. | TLS 1.3 transport security + client-side payload encryption prior to S3/R2 upload. |
| **Quantum Eavesdropping (Harvest Now, Decrypt Later)** | Information Disclosure | Stores encrypted traffic today to decrypt with future quantum computers. | Post-Quantum Hybrid Scheme (NIST ML-KEM-768 / Kyber) combined with classical AES-256 via HKDF. |
| **Client Brute-Force Password Attack** | Elevation of Privilege | Attempts dictionary/brute-force attack on Master Password. | PBKDF2 with **600,000 iterations** of HMAC-SHA512 + Hardware WebAuthn PRF key strengthening + Shamir's Secret Sharing emergency recovery. |
| **Search Pattern Eavesdropping** | Information Disclosure | Server attempts to infer search terms from database queries. | Searchable Symmetric Encryption (SSE) via truncated 64-bit blind HMAC index tokens. |

---

## 3. Cryptographic Primitives & Key Derivation Hierarchy

```
[ Master Password ] + [ Hardware WebAuthn PRF Secret ] + [ Salt ]
                       │
                       ▼ PBKDF2 (600,000 Iterations, HMAC-SHA512)
             [ Master Classical Key K_raw ] ───┐
                                              │
             [ PQC Shared Secret SS_Kyber ] ──┤
                                              ▼
                    [ HKDF-SHA256 Key Combiner ]
                                  │
                                  ▼
                    [ Master AES-256-GCM Key ]
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
[ Payload Encrypt ]       [ Blind Search Index ]  [ Shamir SSS Recovery ]
 (AES-256-GCM 128-tag)   (HMAC-SHA256 Blind Token) (GF(2^8) K-of-N Shares)
```

### Key Derivation Parameters:
- **PBKDF2 Iterations:** $600,000$ (OWASP 2026 standard for SHA-512)
- **AEAD Mode:** AES-256-GCM (`tagLength: 128`)
- **PQC Algorithm:** NIST ML-KEM-768 (Kyber representation)
- **Secret Sharing:** Shamir's Secret Sharing over Galois Field $GF(2^8)$
- **Breach Checking:** $k$-Anonymity range search over HIBP API (5-character SHA-1 prefixing)

---

## 4. Formal Security Invariants & Non-Goals

### Security Guarantees (In Scope):
- Confidentiality of stored secrets against passive/active server compromise.
- Integrity verification of database history via Merkle Tree hash chain.
- Forward secrecy for shared credentials via ephemeral ECDH (X25519) key exchange.
- Zero credential leakage during breach monitoring via $k$-Anonymity.

### Explicit Non-Goals / Limitations:
- **Compromised Client Device:** If the client operating system contains active keyloggers or malicious browser extensions with raw memory access, client-side runtime security cannot be guaranteed.
- **Traffic Volume Analysis:** Server can observe total encrypted storage size and request count.

---

## 5. Emergency Key Recovery & Threshold Cryptography
To address the "forgotten master password" dilemma without introducing a backdoor or server key escrow, Personal Cloud Vault incorporates **Shamir's Secret Sharing (SSS)** over $GF(2^8)$.

- Key $K_{master}$ is split into polynomial shares $S_1, S_2, \dots, S_N$.
- Any $K$ shares reconstruct $K_{master}$ via Lagrange Polynomial Interpolation at $x = 0$:
  $$L_i(0) = \prod_{j \neq i} \frac{x_j}{x_j \oplus x_i}$$
- Less than $K$ shares reveal mathematically **zero information** about $K_{master}$.
