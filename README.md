# MediCast — Autonomous Surgical Video Intelligence

## The Problem
313 million surgical procedures are performed globally each year.
4,000 wrong-site surgeries occur in the US alone.
Surgical video exists for every laparoscopic and endoscopic procedure.
97% of it is never reviewed.

When a complication occurs — and 15% of procedures have one — the
surgical team faces hours of video with no tools to find the critical
moment. MediCast watches every frame, flags every anomaly, and
generates the report before the patient leaves recovery.

## The Product
MediCast is a real-time, five-agent AI surgical intelligence platform
running on AMD GPU infrastructure. Upload any surgical video. Within
minutes, receive:
- Frame-by-frame anatomical annotation from Ana
- Real-time anomaly detection from Sen (severity scored 0-100)
- Procedure tracking and step identification from Nav
- Educational commentary from Edu
- Unified clinical verdict with conflict resolution from The Arbiter
- Cryptographically sealed Surgical Black Box (SHA-256)
- Downloadable structured clinical report

## Market Opportunity
- Global surgical video AI market: $47B by 2030 (CAGR 38%)
- US hospitals spent $8.2B on surgical quality assurance in 2024
- FDA cleared 521 AI medical devices in 2024, up 340% since 2020
- Target customer: Hospital EHR vendors (Epic, Cerner, Oracle Health)
  licensing MediCast as an API — not individual hospitals
- Secondary: Surgical training programs, malpractice insurers, device manufacturers

## Revenue Model
1. API licensing to EHR vendors: $0.45 per procedure analyzed
2. SaaS subscription to surgical residency programs: $2,400/year/program
3. Expert witness / legal discovery: $150/session (Black Box export)

At 1% penetration of US laparoscopic procedures (450,000/year):
ARR = $202,500 from API licensing alone. 10× that for EHR distribution.

## Regulatory Pathway
FDA 510(k) De Novo pathway for "surgical procedure decision support."
Predicate device: existing AI-powered radiology decision support tools.
MediCast does not make diagnoses — it generates decision support
documentation for physician review. This keeps it in the lower-risk
SaMD (Software as a Medical Device) tier.

## Competitive Moat
No direct competitor combines all five of:
- Real-time multi-agent analysis (not batch)
- AMD GPU infrastructure (open source, no NVIDIA lock-in)
- Surgical Black Box (cryptographic tamper evidence)
- Five-agent conflict resolution via The Arbiter
- EHR API-first distribution model

## Technical Architecture
```text
[Frontend (React/Vite)] <---SSE/REST---> [API Gateway (FastAPI)]
                                                |
                                           (Redis Streams)
                                                |
[Ingestion (FFmpeg)] ---> frames:raw ---> [Vision (5 Agents)] ---> frames:analyzed
                                                |
                                          [Compiler] ---> report_ready event
                                                |
                                          [BlackBox Logger]
```

## Setup
1. Install Docker 24+ and Docker Compose v2
2. cp .env.example .env → fill in FIREWORKS_API_KEY
3. docker compose up --build
4. Open http://localhost:3000
5. Upload any surgical video (see "Demo Videos" below)

## Demo Videos (Free, Open License)
Search YouTube for: "laparoscopic cholecystectomy educational"
Filter: Creative Commons license
Recommended: Any 2-5 minute clip shows at least 2-3 procedure steps

## AMD GPU Verification
docker exec medicast-vision-1 python -c "import torch; print(torch.cuda.is_available())"
Expected: True (AMD GPU) or False (CPU fallback with warning)

## Judging Criteria Mapping
- Creativity: Five-agent architecture with Arbiter conflict resolution
- Originality: Surgical Black Box + AMD telemetry dashboard
- Product/Market Potential: $47B TAM + three revenue streams + FDA pathway
- Technical Execution: 8 microservices + real GPU + real SSE + real hashing

## 12-Month Roadmap
Month 1-3: DICOM input support, RTMP live OR stream ingestion
Month 4-6: EHR API beta (Epic SMART on FHIR integration)
Month 7-9: Fine-tune vision model on 10,000 labeled surgical frames
Month 10-12: FDA 510(k) De Novo submission, Series A preparation
