"""The genes the arcade uses, with a one-line reason each is worth knowing.

Chosen to cover the textbook cases a biology student meets: tumour suppressors
and oncogenes, single-letter diseases, repeat expansions, and a few genes whose
stories are about the ethics of editing more than the biology.
"""

GENES: list[dict[str, str]] = [
    {"symbol": "TP53", "title": "Guardian of the genome", "story": "Halts a damaged cell before it divides. Mutated in roughly half of all human cancers."},
    {"symbol": "HBB", "title": "Beta-globin", "story": "One A-to-T change in codon 6 turns haemoglobin into the sickle-cell form."},
    {"symbol": "CFTR", "title": "The chloride gate", "story": "Loses three letters (F508del) in most cystic fibrosis patients, and the channel never reaches the cell surface."},
    {"symbol": "BRCA1", "title": "Break repair", "story": "Repairs double-strand breaks. Broken copies raise breast and ovarian cancer risk sharply."},
    {"symbol": "BRCA2", "title": "The other repair gene", "story": "Partners with BRCA1 in homologous recombination, the same pathway CRISPR borrows to paste in edits."},
    {"symbol": "HTT", "title": "The stutter", "story": "A CAG stretch that grows across generations. Past about 40 repeats, Huntington's disease follows."},
    {"symbol": "DMD", "title": "The longest gene", "story": "2.2 million letters on the X chromosome. Deletions that shift the reading frame cause Duchenne muscular dystrophy."},
    {"symbol": "PAH", "title": "Why the carton warns you", "story": "Without it phenylalanine builds up, which is why every heel-prick test looks for PKU."},
    {"symbol": "HEXA", "title": "The lysosome's enzyme", "story": "Tay-Sachs disease follows when the enzyme stops clearing a lipid from nerve cells."},
    {"symbol": "LDLR", "title": "Cholesterol's doorway", "story": "Pulls LDL out of the blood. Faulty copies cause familial hypercholesterolaemia and won the 1985 Nobel."},
    {"symbol": "APOE", "title": "Three letters, three risks", "story": "Its e2, e3 and e4 forms differ at two positions and shift Alzheimer's risk in both directions."},
    {"symbol": "F8", "title": "Clotting factor VIII", "story": "Haemophilia A. Half its gene sits inside an intron of another gene."},
    {"symbol": "G6PD", "title": "The red cell's shield", "story": "The most common enzyme deficiency on Earth, and the reason fava beans are dangerous for some people."},
    {"symbol": "SMN1", "title": "Motor neuron survival", "story": "Nearly identical to its neighbour SMN2, which is why gene therapy for spinal muscular atrophy works at all."},
    {"symbol": "RHO", "title": "The pigment that sees dim light", "story": "Rhodopsin. Dominant mutations cause retinitis pigmentosa, a target for allele-specific editing."},
    {"symbol": "MECP2", "title": "The reader of methylation", "story": "Rett syndrome. Too little is harmful, and so is too much, which makes dosage the hard problem."},
    {"symbol": "FMR1", "title": "Silenced by repeats", "story": "A CGG expansion switches the gene off entirely, causing fragile X syndrome."},
    {"symbol": "KRAS", "title": "The stuck switch", "story": "A signalling switch jammed in the on position in pancreatic, colorectal and lung cancers."},
    {"symbol": "EGFR", "title": "The growth antenna", "story": "Its mutations made the first targeted lung cancer drugs possible."},
    {"symbol": "PTEN", "title": "The brake on growth", "story": "Opposes the PI3K pathway. Lost in many tumours."},
    {"symbol": "RB1", "title": "The first tumour suppressor", "story": "Retinoblastoma. The gene behind Knudson's two-hit hypothesis."},
    {"symbol": "VHL", "title": "The oxygen sensor", "story": "Marks a protein for destruction when oxygen is plentiful. Its loss drives kidney cancer."},
    {"symbol": "MYH7", "title": "The heart's motor", "story": "Beta-myosin heavy chain. Mutations thicken the heart wall in hypertrophic cardiomyopathy."},
    {"symbol": "INS", "title": "Insulin", "story": "The first human protein made by recombinant DNA, in 1978."},
    {"symbol": "CCR5", "title": "A cautionary tale", "story": "A natural deletion blocks HIV entry. Editing it in embryos in 2018 was condemned worldwide and the researcher was jailed."},
]

SYMBOLS = [g["symbol"] for g in GENES]
BY_SYMBOL = {g["symbol"]: g for g in GENES}
