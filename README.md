**The SB-6 Map** — Texas AI data centers, SB-6 exposure, and the solar+BESS bridge.

Demo #12 · dexdogs

---

## What it is

Texas passed SB-6 in June 2025. Every new data center connecting to ERCOT above 75 MW now faces mandatory curtailment protocols, kill-switch requirements, and full interconnection cost responsibility. This map shows who's exposed, the solar resource at each site (NREL NSRDB), and why battery storage is the rational response — financially and operationally.

---

## Data

All data is pre-processed from the `TX_DataCenter_SB6_BESS_Dataset.xlsx` into `src/data/dataset.json` at build time. No live database. Sources:

- **Sheet 1**: ERCOT Large Load Q&A Dec 2025 · Press releases · Baxtel · datacenterHawk
- **Sheet 2**: EIA Form 860 Final 2024 · interconnection.fyi
- **Sheet 3**: NREL NSRDB PSM v3.0 (GHI/DNI at project coordinates)
- **Sheet 4**: NREL TP-6A40-93281 (BESS costs) · NREL PVSCM Q1-2024 (solar costs) · CPower 4CP benchmark
- **Sheet 5**: TX SB-6 (PURA §39.170) · PUCT Projects 58317/58481/58482/58484

---

## Layers

| Layer | Default | Source |
|---|---|---|
| Solar Resource (GHI heatmap) | ON | NREL NSRDB |
| BESS Compliance Rings | off | Sheet 3+4 |
| BTM Solar Potential | off | Sheet 3 |
| Google Haskell Proof | off | Sheet 1 |
| Power Plants (EIA-860) | off | Sheet 2 |
| SB-6 Exposure Arcs | off | Sheet 3 |
| Substation Access | off | Sheet 2+3 |
