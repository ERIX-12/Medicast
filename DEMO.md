# Demo Script — MediCast

This script is for the submission demo video. Record it. Include it
as DEMO.md in the repo and reference it in README.md.

**[0:00-0:20] THE PROBLEM (speak directly to camera)**
"Every year, 313 million surgeries happen globally. 15% have complications.
When something goes wrong, surgeons face 90 minutes of video with no tools.
MediCast watches every frame. Right now. On AMD hardware."

**[0:20-0:45] THE ARCHITECTURE (screen: docker ps output)**
"Eight microservices. Five AI agents. Running on AMD GPU via ROCm.
Redis streams connect them. No mocks. No fakes. Every frame hits
real Fireworks AI API calls with AMD-hardware models."

**[0:45-2:00] THE DEMO (screen: upload video, watch it run)**
- Upload a cholecystectomy clip
- Watch thumbnails populate
- Point to the 5-panel agent cards appearing in real time
- Highlight: "Ana identified the hepatocystic triangle here"
- Highlight: "Sen flagged a severity 72 anomaly — the system auto-escalated"
- Show the red border on the escalated card
- Show AMD telemetry sidebar: "94% GPU utilization, 240ms inference latency"

**[2:00-2:30] THE ARBITER (screen: zoom into Arbiter card)**
"No other system does this. The Arbiter receives all four agent reports,
detects conflicts, and produces a unified clinical verdict.
Here, Ana and Sen disagreed on this region. Arb resolved it:
the structure was normal anatomy obscured by smoke — not a complication."

**[2:30-3:00] THE BLACK BOX (screen: Black Box panel)**
"Every finding is cryptographically sealed. SHA-256.
If a complication occurs post-op, this is the audit trail.
Tamper-evident. Legally defensible. Built exclusively for AMD MI300X capabilities."
