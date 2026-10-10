const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

const bioContent = {
  1: { t: "Water: The Solvent of Life", txt: "Water is polar, meaning it has a partial positive charge on hydrogens and a partial negative charge on oxygen. This polarity allows it to form hydrogen bonds, making it an excellent solvent for other polar molecules and ions. Without water, cellular chemistry would halt." },
  2: { t: "Carbon and Macromolecules", txt: "Carbon's ability to form four covalent bonds makes it the backbone of life. It creates complex, diverse macromolecules like carbohydrates, lipids, proteins, and nucleic acids. These molecules are typically formed via dehydration synthesis reactions." },
  3: { t: "Carbohydrates: Energy & Structure", txt: "Carbohydrates (sugars) provide immediate energy and structural support. Glucose is the primary fuel for cells, while polysaccharides like cellulose provide structural integrity to plant cell walls, and glycogen stores energy in animals." },
  4: { t: "Lipids: Membranes & Storage", txt: "Lipids are hydrophobic molecules. Triglycerides store immense amounts of energy, while phospholipids form the fundamental bilayer of all cellular membranes. Steroids, like cholesterol, maintain membrane fluidity and act as signaling hormones." },
  5: { t: "The Fluid Mosaic Model", txt: "The plasma membrane is a 'fluid mosaic' of phospholipids, cholesterol, and proteins. It is not rigid; lipids and proteins constantly drift laterally. This flexibility is crucial for cell division, shape changes, and vesicle fusion." },
  6: { t: "Simple vs Facilitated Diffusion", txt: "Diffusion is the passive movement of molecules down their concentration gradient. Small, nonpolar molecules (like O2) simply slip through the membrane. Polar molecules or ions require 'facilitated diffusion' via specific protein channels to cross the hydrophobic core." },
  7: { t: "Active Transport & Pumps", txt: "When a cell needs to move substances against their gradient (from low to high concentration), it requires energy (ATP). The Sodium-Potassium pump is a classic example, using ATP to maintain vital electrochemical gradients across the membrane." },
  8: { t: "The Nucleus: Command Center", txt: "The nucleus houses the cell's genetic material (DNA). It is enclosed by a double membrane called the nuclear envelope, punctuated by pores that regulate the entry and exit of RNA and proteins. The nucleolus, inside the nucleus, synthesizes ribosomes." },
  9: { t: "Ribosomes: Protein Factories", txt: "Ribosomes are complexes of rRNA and proteins that translate messenger RNA (mRNA) into polypeptide chains. They can be free-floating in the cytoplasm (making proteins for the cell's own use) or bound to the Endoplasmic Reticulum (for secreted proteins)." },
  10: { t: "The Endoplasmic Reticulum", txt: "The ER is a massive network of membranous tubules. Rough ER (studded with ribosomes) synthesizes and folds proteins destined for membranes or secretion. Smooth ER lacks ribosomes and synthesizes lipids, detoxifies poisons, and stores calcium." },
  11: { t: "The Golgi Apparatus", txt: "The Golgi is the cell's shipping and receiving center. It consists of flattened sacs called cisternae. Proteins arriving from the ER are modified (e.g., glycosylated), sorted, and packaged into transport vesicles bound for their final destinations." },
  12: { t: "Lysosomes: Cellular Digestion", txt: "Lysosomes are acidic sacs containing hydrolytic enzymes. They digest food particles, destroy invading viruses, and recycle damaged organelles in a process called autophagy. Without lysosomes, cellular waste would accumulate fatally." },
  13: { t: "Microtubules & Microfilaments", txt: "The cytoskeleton provides structural support and motility. Microtubules are thick, hollow tubes acting as tracks for motor proteins and pulling chromosomes apart during division. Microfilaments (actin) are thin strands vital for cell contraction and shape." },
  14: { t: "Enzyme Thermodynamics", txt: "Enzymes do not alter the overall thermodynamics (Delta G) of a reaction; they only lower the activation energy required to start it. They achieve this by binding substrates at their active site, orienting them perfectly to facilitate the chemical reaction." },
  15: { t: "Enzyme Inhibition", txt: "Competitive inhibitors mimic the substrate and block the active site directly. Non-competitive (allosteric) inhibitors bind elsewhere, changing the enzyme's shape so the active site no longer functions. This is a common mechanism for feedback inhibition." },
  16: { t: "ATP: The Cellular Currency", txt: "Adenosine Triphosphate (ATP) stores energy in its unstable phosphate bonds. When the terminal phosphate is hydrolyzed (forming ADP), energy is released to power cellular work, such as active transport, muscle contraction, or chemical synthesis." },
  17: { t: "Glycolysis: Splitting Sugar", txt: "Glycolysis occurs in the cytoplasm and requires no oxygen. It splits one 6-carbon glucose into two 3-carbon pyruvate molecules, yielding a net gain of 2 ATP and 2 NADH. It is the universal first step of cellular respiration." },
  18: { t: "Pyruvate Oxidation", txt: "Before entering the Krebs cycle, pyruvate moves into the mitochondria where it is oxidized and converted into Acetyl-CoA. This step releases CO2 and reduces NAD+ to NADH, acting as the critical link between glycolysis and the Krebs cycle." },
  19: { t: "The Krebs Cycle (Citric Acid)", txt: "Occurring in the mitochondrial matrix, the Krebs cycle completely oxidizes the Acetyl-CoA. It produces a small amount of ATP, but its main purpose is to harvest high-energy electrons, transferring them to carrier molecules (NADH and FADH2)." },
  20: { t: "The Electron Transport Chain", txt: "Located on the inner mitochondrial membrane, the ETC is a series of protein complexes. Electrons from NADH and FADH2 are passed down the chain, releasing energy that is used to pump protons (H+) into the intermembrane space, creating a massive gradient." },
  21: { t: "Chemiosmosis & ATP Synthase", txt: "The proton gradient created by the ETC represents potential energy. Protons flow back into the matrix through an enzyme called ATP Synthase. This flow spins a rotor within the enzyme, driving the synthesis of roughly 28-32 ATP molecules per glucose." },
  22: { t: "Light-Dependent Reactions", txt: "In the chloroplast's thylakoid membranes, chlorophyll absorbs solar energy, which excites electrons. These electrons travel down a photosynthetic ETC, generating ATP and NADPH. Water is split to replace the electrons, releasing oxygen as a byproduct." },
  23: { t: "The Calvin Cycle (Dark Reactions)", txt: "Occurring in the chloroplast stroma, the Calvin Cycle uses the ATP and NADPH generated by the light reactions to fix carbon dioxide from the air into organic sugar molecules (G3P). This is the foundation of the global food chain." },
  24: { t: "DNA: The Double Helix", txt: "DNA consists of two anti-parallel strands of nucleotides. The sugar-phosphate backbone provides structure, while the nitrogenous bases (A, T, C, G) point inward. A pairs with T via two hydrogen bonds, and C pairs with G via three, ensuring uniform width." },
  25: { t: "Helicase and Topoisomerase", txt: "During replication, Helicase unzips the DNA double helix by breaking hydrogen bonds. This creates intense twisting tension ahead of the replication fork, which is relieved by Topoisomerase, an enzyme that cuts, untwists, and rejoins the DNA strands." },
  26: { t: "DNA Polymerase and Ligase", txt: "DNA Polymerase synthesizes the new DNA strand by adding nucleotides to the 3' end. Because it can only build 5' to 3', the 'lagging strand' is built in chunks called Okazaki fragments. DNA Ligase then acts as cellular glue, sealing the fragments together." },
  27: { t: "Transcription: DNA to mRNA", txt: "Transcription occurs in the nucleus. RNA Polymerase binds to a promoter region on the DNA, unzips the helix, and builds a single-stranded messenger RNA (mRNA) transcript that is complementary to the template gene." },
  28: { t: "RNA Processing (Splicing)", txt: "Before leaving the nucleus, the raw pre-mRNA is modified. A 5' cap and a 3' poly-A tail are added for protection. Then, non-coding regions called introns are cut out (spliced), and the coding regions (exons) are joined together." },
  29: { t: "Translation: mRNA to Protein", txt: "In the cytoplasm, the ribosome reads the mRNA sequence in triplets called codons. Transfer RNA (tRNA) molecules carry specific amino acids to the ribosome. The tRNA's anticodon binds to the mRNA codon, ensuring the correct amino acid is added to the chain." },
  30: { t: "Mutations: Point vs Frameshift", txt: "A point mutation changes a single nucleotide. It might be silent, or it might change one amino acid (missense). A frameshift mutation (insertion or deletion) shifts the entire reading frame of the ribosome, usually resulting in a completely non-functional protein." },
  31: { t: "The Cell Cycle (Interphase)", txt: "A cell spends most of its life in Interphase, which is divided into G1 (growth), S (DNA synthesis/replication), and G2 (preparation for division). Strict checkpoints ensure the cell does not divide if its DNA is damaged." },
  32: { t: "Mitosis: PMAT", txt: "Mitosis divides the nucleus. Prophase (chromosomes condense), Metaphase (chromosomes align at the equator), Anaphase (sister chromatids are pulled apart), and Telophase (new nuclei form). This is immediately followed by cytokinesis, splitting the cell in two." }
};

let matchCount = 0;

for (let i = 1; i <= 32; i++) {
  const id = 'bio-gen-' + i;
  const t = bioContent[i];
  if (!t) continue;
  
  const regex = new RegExp(`topic\\('${id}'[\\s\\S]*?\\\]\\)`);
  
  const replacement = `topic('${id}', '${t.t.replace(/'/g, "\\'")}', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'text', body: '${t.txt.replace(/'/g, "\\'")}' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ])`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    matchCount++;
  }
}

fs.writeFileSync(file, code);
console.log('Fixed ' + matchCount + ' Biology topics!');
