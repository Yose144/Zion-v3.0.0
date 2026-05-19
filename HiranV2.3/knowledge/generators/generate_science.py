#!/usr/bin/env python3
"""
Hiran v2.3 Knowledge: Science
Basic science documents across physics, chemistry, biology, astronomy, and mathematics.
"""

from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "corpora"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SCIENCE_DOCUMENTS = [
    {
        "title": "Physics: The Fundamental Forces and Laws of Nature",
        "content": """Physics seeks to understand the fundamental nature of reality. Four fundamental forces govern the universe:

1. Gravitation: The weakest force but with infinite range. Every mass attracts every other mass. Described by Newton's law (F = Gm₁m₂/r²) and Einstein's general relativity (mass curves spacetime). Governs planetary orbits, galaxy formation, and the expansion of the universe.

2. Electromagnetism: Governs light, electricity, magnetism, and chemistry. Described by Maxwell's equations. Infinite range but much stronger than gravity. Responsible for atomic structure, chemical bonding, and all electrical technology.

3. Strong Nuclear Force: Holds protons and neutrons together in atomic nuclei. Range of about 1 femtometer (10^-15 meters). Mediated by gluons. Overcomes electromagnetic repulsion between protons. Without it, atoms heavier than hydrogen could not exist.

4. Weak Nuclear Force: Responsible for radioactive decay (beta decay). Range of about 0.01 femtometers. Mediated by W and Z bosons. Essential for nuclear fusion in stars — converting hydrogen to helium.

Key physics concepts:
- Conservation laws: Energy, momentum, angular momentum, and electric charge are conserved in isolated systems.
- Thermodynamics: Four laws governing heat, energy, and entropy. The Second Law states that entropy in an isolated system always increases — time has a direction.
- Quantum mechanics: At small scales, particles behave as waves and waves as particles. Heisenberg's uncertainty principle limits how precisely position and momentum can be known simultaneously. Quantum entanglement allows instantaneous correlation between distant particles.
- Special relativity: E = mc². Time slows at high speeds, lengths contract. Nothing with mass can reach the speed of light.
- General relativity: Massive objects curve spacetime. This curvature IS gravity. Predicts black holes, gravitational waves, and gravitational lensing.
- The Standard Model: Describes all known elementary particles (quarks, leptons, gauge bosons, Higgs boson) and three of the four forces (excluding gravity)."""
    },
    {
        "title": "Chemistry: The Science of Matter and Its Transformations",
        "content": """Chemistry studies matter, its properties, composition, structure, and the changes it undergoes.

The Atom: The basic unit of matter. Protons (+) and neutrons (neutral) in the nucleus; electrons (-) orbit in shells. Atomic number = number of protons. Elements are organized in the periodic table by atomic number and electron configuration.

Chemical Bonds:
- Ionic: Electron transfer (e.g., NaCl — sodium gives an electron to chlorine)
- Covalent: Electron sharing (e.g., H₂O — hydrogen and oxygen share electrons)
- Metallic: Electron sea (metals share electrons freely, allowing conductivity)
- Hydrogen: Weak attraction between hydrogen and electronegative atoms (crucial for water and DNA)

States of Matter:
- Solid: Fixed shape, particles vibrate in place
- Liquid: Fixed volume, particles flow past each other
- Gas: Expands to fill space, particles move freely
- Plasma: Ionized gas, found in stars and neon lights

Key Chemistry Concepts:
- Acids and Bases: pH scale (0-14). Acids donate protons (H⁺); bases accept them. Neutral pH is 7 (water).
- Oxidation-Reduction (Redox): Reactions involving electron transfer. Oxidation loses electrons; reduction gains. Essential for batteries, rust, metabolism.
- Organic Chemistry: Study of carbon compounds. Carbon forms 4 bonds, enabling complex molecules. Hydrocarbons (alkanes, alkenes, alkynes), alcohols, carboxylic acids, amino acids.
- Biochemistry: Chemistry of living things. Four macromolecules: carbohydrates (energy), lipids (membranes, storage), proteins (enzymes, structure), nucleic acids (DNA, RNA — genetic information).
- The Mole: 6.022 × 10²³ particles (Avogadro's number). Bridges atomic and macroscopic scales."""
    },
    {
        "title": "Biology: The Study of Life",
        "content": """Life on Earth is carbon-based, uses water as a solvent, and stores information in DNA.

Cell Theory: All living things are made of cells. The cell is the basic unit of life. All cells come from pre-existing cells.

Types of Cells:
- Prokaryotes: No nucleus (bacteria, archaea). Simple, single-celled, 1-10 micrometers.
- Eukaryotes: Have nucleus (animals, plants, fungi, protists). Complex, can be multicellular, 10-100 micrometers.

DNA (Deoxyribonucleic Acid): The molecule of heredity. Double helix structure (Watson and Crick, 1953). Four bases: Adenine (A), Thymine (T), Cytosine (C), Guanine (G). A pairs with T, C pairs with G. The sequence of bases encodes genetic information.

Central Dogma of Molecular Biology: DNA → RNA → Protein. Genes (DNA sequences) are transcribed into mRNA, which is translated by ribosomes into proteins.

Evolution by Natural Selection (Darwin, 1859):
- Variation exists in populations
- Resources are limited → competition for survival
- Individuals with advantageous traits are more likely to survive and reproduce
- Over generations, advantageous traits become more common
- This explains adaptation, speciation, and the diversity of life

Key Biological Systems:
- Photosynthesis: Plants convert CO₂ + H₂O + sunlight into glucose + O₂. The foundation of Earth's food web.
- Cellular Respiration: Cells break down glucose to produce ATP (energy). C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP.
- The Immune System: White blood cells, antibodies, and lymph nodes defend against pathogens.
- The Nervous System: Neurons transmit electrical and chemical signals. The brain contains ~86 billion neurons.
- Endocrine System: Hormones regulate metabolism, growth, reproduction, and mood.

Classification of Life: Domain → Kingdom → Phylum → Class → Order → Family → Genus → Species. Three domains: Bacteria, Archaea, Eukarya."""
    },
    {
        "title": "Astronomy: The Universe and Our Place In It",
        "content": """The universe began approximately 13.8 billion years ago in the Big Bang — a moment of extreme density and temperature that expanded rapidly.

The Observable Universe: About 93 billion light-years in diameter. Contains 2 trillion galaxies. Ordinary matter makes up only 5%; dark matter (27%) and dark energy (68%) dominate.

Our Solar System:
- The Sun: A G-type main-sequence star. 99.86% of the solar system's mass. Core temperature: 15 million °C. Fusion of hydrogen to helium produces energy.
- Inner planets (terrestrial): Mercury, Venus, Earth, Mars. Rocky, relatively small, close to the Sun.
- Asteroid Belt: Between Mars and Jupiter. Failed planet material.
- Outer planets (gas/ice giants): Jupiter (largest, Great Red Spot), Saturn (rings), Uranus, Neptune.
- Pluto and other dwarf planets: Reclassified in 2006.
- Earth's Moon: Formed from a Mars-sized impactor ~4.5 billion years ago.

The Milky Way: Our galaxy. A barred spiral galaxy, ~100,000 light-years across, containing 100-400 billion stars. The Sun is 26,000 light-years from the galactic center. One rotation takes ~225 million years.

Types of Stars:
- Main sequence: Fusing hydrogen (our Sun, ~10 billion year lifespan)
- Red giants: Exhausted core hydrogen, expanded outer layers
- White dwarfs: Collapsed core of a dead star, Earth-sized but solar-mass
- Neutron stars: City-sized, incredibly dense (teaspoon = mountain mass)
- Black holes: Gravity so strong that nothing escapes, not even light

Exoplanets: Planets orbiting other stars. Thousands detected via transit method (Kepler, TESS). Some in the "habitable zone" where liquid water could exist.

Key Astronomical Concepts:
- Light-year: Distance light travels in one year (~9.46 trillion km)
- Redshift: Light from distant objects shifts toward red — the universe is expanding
- Hubble's Law: Galaxies recede at speeds proportional to distance
- Black holes: Event horizon (point of no return), singularity (infinite density)
- Gravitational waves: Ripples in spacetime from merging black holes/neutron stars (detected 2015 by LIGO)"""
    },
    {
        "title": "Mathematics: The Language of Patterns",
        "content": """Mathematics is the abstract study of patterns, structure, quantity, and change.

Number Systems:
- Natural numbers (ℕ): 1, 2, 3, ...
- Integers (ℤ): ..., -2, -1, 0, 1, 2, ...
- Rational numbers (ℚ): fractions p/q
- Real numbers (ℝ): all points on the number line
- Complex numbers (ℂ): a + bi, where i² = -1

Algebra: Study of equations and structures. A quadratic equation ax² + bx + c = 0 has solutions x = (-b ± √(b²-4ac)) / 2a. Linear algebra studies vectors, matrices, and transformations.

Calculus: The mathematics of change.
- Differential calculus: Rates of change (derivatives). The derivative of x² is 2x.
- Integral calculus: Accumulation (areas under curves). The integral of 2x is x².
- The Fundamental Theorem of Calculus: Differentiation and integration are inverse operations.

Geometry: Study of shapes, sizes, and spatial relationships.
- Euclidean geometry: Points, lines, planes, angles, triangles, circles. Parallel lines never meet.
- Non-Euclidean geometry: On curved surfaces, parallel lines can meet (sphere) or diverge (saddle).
- Topology: Studies properties preserved under continuous deformation (a coffee cup and donut are topologically equivalent).

Probability and Statistics:
- Probability measures likelihood (0 = impossible, 1 = certain).
- The normal distribution (bell curve) describes many natural phenomena.
- Central Limit Theorem: Averages of random samples approach a normal distribution.
- Bayes' Theorem: Updates probabilities based on new evidence.

Famous Theorems:
- Pythagorean theorem: a² + b² = c² (right triangles)
- Fermat's Last Theorem: aⁿ + bⁿ = cⁿ has no integer solutions for n > 2 (proved 1995)
- Gödel's Incompleteness Theorems: In any consistent formal system, there are true statements that cannot be proved within the system
- The Four Color Theorem: Any map can be colored with 4 colors so adjacent regions differ
- The Riemann Hypothesis: Unsolved — the distribution of prime numbers follows a specific pattern"""
    },
]

def write_documents(docs, filename_prefix):
    for i, doc in enumerate(docs):
        filename = OUTPUT_DIR / f"{filename_prefix}_{i:03d}.md"
        content = f"""# {doc['title']}

**Domain:** Science
**Category:** {filename_prefix.replace('_', ' ').title()}
**Date Indexed:** {datetime.now().strftime('%Y-%m-%d')}
**Language:** English

---

{doc['content']}

---
*Source: Generated knowledge corpus for Hiran v2.3 RAG system*
"""
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
    print(f"  Written {len(docs)} documents to {filename_prefix}_*.md")


def main():
    print("Generating science knowledge corpus...")
    write_documents(SCIENCE_DOCUMENTS, "science")
    print(f"\nScience corpus complete. Files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
