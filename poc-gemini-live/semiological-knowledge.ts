/**
 * Semiological Knowledge Integration System
 * Provides structured semiological knowledge for physician support
 */

interface SemiologicalSign {
  name: string;
  description: string;
  technique: string;
  positive_finding: string;
  clinical_significance: string;
  conditions: string[];
  sensitivity: number;
  specificity: number;
  likelihood_ratio_positive: number;
  likelihood_ratio_negative: number;
}

interface ClinicalSyndrome {
  name: string;
  major_criteria: string[];
  minor_criteria: string[];
  diagnostic_rule: string;
  pathophysiology: string;
  differential_diagnoses: string[];
}

interface ExaminationProtocol {
  system: string;
  inspection: string[];
  palpation: string[];
  percussion: string[];
  auscultation: string[];
  special_maneuvers: string[];
}

interface SemiologicalInterpretation {
  finding: string;
  clinical_significance: string;
  differential_impact: number;
  conditions_affected: { condition: string; probability_change: number }[];
  recommended_follow_up: string[];
}

export class SemiologicalKnowledge {
  
  // Pathognomonic and characteristic signs
  private pathognomicSigns: { [key: string]: SemiologicalSign } = {
    "murphy_sign": {
      name: "Sinal de Murphy",
      description: "Dor à palpação profunda no ponto cístico durante inspiração",
      technique: "Palpação profunda abaixo do rebordo costal direito durante inspiração profunda",
      positive_finding: "Interrupção súbita da inspiração devido à dor",
      clinical_significance: "Altamente sugestivo de colecistite aguda",
      conditions: ["Colecistite aguda", "Colangite"],
      sensitivity: 0.65,
      specificity: 0.87,
      likelihood_ratio_positive: 5.0,
      likelihood_ratio_negative: 0.4
    },
    
    "babinski_sign": {
      name: "Sinal de Babinski",
      description: "Extensão do hálux com abertura em leque dos outros dedos",
      technique: "Estímulo firme com objeto rombo na borda lateral da planta do pé",
      positive_finding: "Extensão do hálux + abertura dos outros dedos",
      clinical_significance: "Lesão do trato corticoespinal (neurônio motor superior)",
      conditions: ["AVC", "Tumor cerebral", "Esclerose múltipla", "Mielopatia"],
      sensitivity: 0.75,
      specificity: 0.94,
      likelihood_ratio_positive: 12.5,
      likelihood_ratio_negative: 0.27
    },
    
    "kernig_sign": {
      name: "Sinal de Kernig",
      description: "Resistência e dor à extensão da perna com coxa fletida a 90°",
      technique: "Flexão da coxa a 90° + tentativa de extensão da perna",
      positive_finding: "Resistência e dor à extensão da perna",
      clinical_significance: "Irritação meníngea",
      conditions: ["Meningite", "Hemorragia subaracnoide", "Abscesso cerebral"],
      sensitivity: 0.53,
      specificity: 0.89,
      likelihood_ratio_positive: 4.8,
      likelihood_ratio_negative: 0.53
    },
    
    "brudzinski_sign": {
      name: "Sinal de Brudzinski",
      description: "Flexão involuntária das pernas ao flexionar o pescoço",
      technique: "Flexão passiva do pescoço com paciente em decúbito dorsal",
      positive_finding: "Flexão involuntária dos joelhos e quadris",
      clinical_significance: "Irritação meníngea",
      conditions: ["Meningite", "Hemorragia subaracnoide"],
      sensitivity: 0.47,
      specificity: 0.95,
      likelihood_ratio_positive: 9.4,
      likelihood_ratio_negative: 0.56
    },
    
    "gallop_s3": {
      name: "Galope S3",
      description: "Terceira bulha cardíaca audível no final da diástole",
      technique: "Ausculta no ictus com paciente em decúbito lateral esquerdo",
      positive_finding: "Som adicional após S2, ritmo de galope",
      clinical_significance: "Disfunção sistólica do VE",
      conditions: ["Insuficiência cardíaca sistólica", "Cardiomiopatia dilatada"],
      sensitivity: 0.61,
      specificity: 0.95,
      likelihood_ratio_positive: 11.0,
      likelihood_ratio_negative: 0.41
    },
    
    "diastolic_murmur": {
      name: "Sopro diastólico",
      description: "Sopro audível durante a diástole",
      technique: "Ausculta cardíaca em todos os focos, especial atenção ao aórtico",
      positive_finding: "Som turbulento durante diástole",
      clinical_significance: "Sempre patológico - indica regurgitação ou estenose",
      conditions: ["Insuficiência aórtica", "Estenose mitral", "Insuficiência pulmonar"],
      sensitivity: 0.84,
      specificity: 0.90,
      likelihood_ratio_positive: 8.2,
      likelihood_ratio_negative: 0.18
    }
  };

  // Clinical syndromes
  private clinicalSyndromes: { [key: string]: ClinicalSyndrome } = {
    "heart_failure": {
      name: "Síndrome de Insuficiência Cardíaca",
      major_criteria: [
        "Dispneia paroxística noturna",
        "Distensão venosa jugular",
        "Estertores pulmonares",
        "Cardiomegalia radiológica",
        "Edema agudo pulmonar",
        "Galope S3",
        "Pressão venosa central >16 cmH2O",
        "Tempo de circulação >25 segundos"
      ],
      minor_criteria: [
        "Edema de extremidades",
        "Tosse noturna",
        "Dispneia de esforço",
        "Hepatomegalia",
        "Derrame pleural",
        "Taquicardia >120 bpm",
        "Perda de peso >4,5 kg em 5 dias"
      ],
      diagnostic_rule: "2 critérios maiores OU 1 maior + 2 menores",
      pathophysiology: "Incapacidade do coração bombear sangue adequadamente",
      differential_diagnoses: ["Embolia pulmonar", "DPOC descompensado", "Pneumonia", "Síndrome nefrótica"]
    },
    
    "acute_abdomen": {
      name: "Abdome Agudo",
      major_criteria: [
        "Dor abdominal súbita e intensa",
        "Rigidez abdominal (defesa muscular)",
        "Sinal de Blumberg positivo",
        "Ausência de ruídos hidroaéreos",
        "Distensão abdominal",
        "Vômitos persistentes"
      ],
      minor_criteria: [
        "Febre",
        "Taquicardia",
        "Leucocitose",
        "Dor à mobilização",
        "Posição antálgica"
      ],
      diagnostic_rule: "2 critérios maiores OU 1 maior + 3 menores",
      pathophysiology: "Processo inflamatório, obstrutivo ou perfurativo abdominal",
      differential_diagnoses: ["Apendicite", "Colecistite", "Pancreatite", "Obstrução intestinal", "Perfuração visceral"]
    },
    
    "meningeal_irritation": {
      name: "Síndrome de Irritação Meníngea",
      major_criteria: [
        "Rigidez de nuca",
        "Sinal de Kernig positivo",
        "Sinal de Brudzinski positivo",
        "Cefaleia intensa",
        "Fotofobia"
      ],
      minor_criteria: [
        "Febre",
        "Náuseas e vômitos",
        "Confusão mental",
        "Petéquias",
        "Sonolência"
      ],
      diagnostic_rule: "2 critérios maiores OU 1 maior + 2 menores",
      pathophysiology: "Inflamação ou irritação das meninges",
      differential_diagnoses: ["Meningite bacteriana", "Meningite viral", "Hemorragia subaracnoide", "Encefalite"]
    }
  };

  // Examination protocols by system
  private examinationProtocols: { [key: string]: ExaminationProtocol } = {
    "cardiovascular": {
      system: "Sistema Cardiovascular",
      inspection: [
        "Cianose central (língua, lábios) vs periférica (extremidades)",
        "Edema (localização, intensidade, cacifo)",
        "Distensão venosa jugular (paciente a 45°)",
        "Deformidades torácicas",
        "Presença de cicatrizes cirúrgicas"
      ],
      palpation: [
        "Ictus cordis: localização, intensidade, características",
        "Pulsos arteriais: amplitude, ritmo, simetria",
        "Frêmitos cardíacos (sistólicos/diastólicos)",
        "Hepatomegalia e pulsatilidade hepática",
        "Edema: extensão, simetria, temperatura"
      ],
      percussion: [
        "Área cardíaca (macicez cardíaca)",
        "Borda hepática",
        "Presença de ascite"
      ],
      auscultation: [
        "4 focos cardíacos: mitral, tricúspide, aórtico, pulmonar",
        "Características das bulhas (intensidade, desdobramento)",
        "Sopros: localização, irradiação, intensidade",
        "Galopes S3/S4, clicks, atritos"
      ],
      special_maneuvers: [
        "Manobra de Valsalva (mudança de sopros)",
        "Handgrip (aumenta pós-carga)",
        "Posição ortostática (muda retorno venoso)",
        "Refluxo hepatojugular"
      ]
    },
    
    "pulmonary": {
      system: "Sistema Respiratório",
      inspection: [
        "Padrão respiratório (frequência, amplitude, ritmo)",
        "Uso de musculatura acessória",
        "Cianose central vs periférica",
        "Baqueteamento digital",
        "Deformidades torácicas (pectus, cifoescoliose)"
      ],
      palpation: [
        "Expansibilidade torácica (simétrica vs assimétrica)",
        "Frêmito toracovocal",
        "Pontos dolorosos",
        "Enfisema subcutâneo",
        "Linfonodos supraclaviculares e axilares"
      ],
      percussion: [
        "Sonoridade pulmonar comparativa",
        "Limites diafragmáticos",
        "Áreas de macicez ou timpanismo",
        "Mobilidade diafragmática"
      ],
      auscultation: [
        "Murmúrio vesicular (presente, diminuído, ausente)",
        "Ruídos adventícios: estertores, roncos, sibilos",
        "Ausculta da voz: broncofonia, pectorilóquia",
        "Atrito pleural"
      ],
      special_maneuvers: [
        "Ausculta durante respiração profunda",
        "Teste da voz sussurrada",
        "Percussão durante inspiração/expiração"
      ]
    },
    
    "abdominal": {
      system: "Sistema Abdominal",
      inspection: [
        "Formato do abdome (plano, globoso, distendido)",
        "Cicatrizes cirúrgicas",
        "Circulação colateral",
        "Hérnias (inguinais, umbilicais, incisionais)",
        "Movimentos respiratórios abdominais"
      ],
      palpation: [
        "Palpação superficial (defesa muscular, massas)",
        "Palpação profunda (organomegalias, massas)",
        "Pontos dolorosos específicos (McBurney, Murphy)",
        "Pulsos abdominais",
        "Linfonodos inguinais"
      ],
      percussion: [
        "Timpanismo vs macicez",
        "Borda hepática e esplênica",
        "Presença de ascite (piparote)",
        "Dor à percussão (Murphy percutório)"
      ],
      auscultation: [
        "Ruídos hidroaéreos (presentes, aumentados, diminuídos, ausentes)",
        "Sopros abdominais",
        "Atritos hepático ou esplênico"
      ],
      special_maneuvers: [
        "Sinal de Murphy",
        "Sinal de Blumberg",
        "Sinal de Rovsing",
        "Manobra do psoas",
        "Manobra do obturador",
        "Pesquisa de ascite (macicez móvel)"
      ]
    },
    
    "neurological": {
      system: "Sistema Neurológico",
      inspection: [
        "Estado de consciência (Glasgow)",
        "Postura e marcha",
        "Movimentos involuntários (tremores, fasciculações)",
        "Assimetrias faciais",
        "Atrofias musculares"
      ],
      palpation: [
        "Tônus muscular",
        "Pontos dolorosos",
        "Pulsos temporais",
        "Rigidez de nuca"
      ],
      percussion: [
        "Reflexos tendinosos (bicipital, tricipital, patelar, aquileu)",
        "Reflexos cutâneos (abdominal, cremastérico)"
      ],
      auscultation: [
        "Sopros carotídeos",
        "Sopros cranianos"
      ],
      special_maneuvers: [
        "Sinal de Babinski",
        "Sinal de Kernig",
        "Sinal de Brudzinski",
        "Teste de coordenação (índex-nariz)",
        "Teste de Romberg",
        "Exame dos pares cranianos"
      ]
    }
  };

  /**
   * Get semiological sign information
   */
  getSemiologicalSign(signName: string): SemiologicalSign | null {
    const normalizedName = signName.toLowerCase().replace(/\s+/g, '_');
    return this.pathognomicSigns[normalizedName] || null;
  }

  /**
   * Get clinical syndrome information
   */
  getClinicalSyndrome(syndromeName: string): ClinicalSyndrome | null {
    const normalizedName = syndromeName.toLowerCase().replace(/\s+/g, '_');
    return this.clinicalSyndromes[normalizedName] || null;
  }

  /**
   * Get examination protocol for specific system
   */
  getExaminationProtocol(system: string): ExaminationProtocol | null {
    const normalizedSystem = system.toLowerCase().replace(/\s+/g, '_');
    return this.examinationProtocols[normalizedSystem] || null;
  }

  /**
   * Generate examination recommendations based on symptoms and differential diagnoses
   */
  generateExaminationRecommendations(
    symptoms: string[],
    differentialDiagnoses: string[]
  ): {
    priority_systems: string[];
    recommended_maneuvers: string[];
    specific_signs_to_check: SemiologicalSign[];
  } {
    
    const prioritySystems: Set<string> = new Set();
    const recommendedManeuvers: Set<string> = new Set();
    const specificSigns: SemiologicalSign[] = [];
    
    // Determine relevant systems based on symptoms
    symptoms.forEach(symptom => {
      const lowerSymptom = symptom.toLowerCase();
      
      if (this.isCardiovascularSymptom(lowerSymptom)) {
        prioritySystems.add('cardiovascular');
      }
      if (this.isPulmonarySymptom(lowerSymptom)) {
        prioritySystems.add('pulmonary');
      }
      if (this.isAbdominalSymptom(lowerSymptom)) {
        prioritySystems.add('abdominal');
      }
      if (this.isNeurologicalSymptom(lowerSymptom)) {
        prioritySystems.add('neurological');
      }
    });
    
    // Add specific signs based on differential diagnoses
    differentialDiagnoses.forEach(diagnosis => {
      const lowerDiagnosis = diagnosis.toLowerCase();
      
      Object.values(this.pathognomicSigns).forEach(sign => {
        if (sign.conditions.some(condition => 
          condition.toLowerCase().includes(lowerDiagnosis) || 
          lowerDiagnosis.includes(condition.toLowerCase())
        )) {
          specificSigns.push(sign);
        }
      });
    });
    
    // Add system-specific maneuvers
    Array.from(prioritySystems).forEach(system => {
      const protocol = this.examinationProtocols[system];
      if (protocol) {
        protocol.special_maneuvers.forEach(maneuver => {
          recommendedManeuvers.add(maneuver);
        });
      }
    });
    
    return {
      priority_systems: Array.from(prioritySystems),
      recommended_maneuvers: Array.from(recommendedManeuvers),
      specific_signs_to_check: specificSigns
    };
  }

  /**
   * Interpret a clinical finding and its significance
   */
  interpretClinicalFinding(
    finding: string,
    reportedSymptoms: string[]
  ): SemiologicalInterpretation {
    
    const lowerFinding = finding.toLowerCase();
    
    // Check if it matches a known pathognomonic sign
    const matchedSign = Object.values(this.pathognomicSigns).find(sign => 
      lowerFinding.includes(sign.name.toLowerCase()) ||
      lowerFinding.includes(sign.description.toLowerCase())
    );
    
    if (matchedSign) {
      return {
        finding: finding,
        clinical_significance: matchedSign.clinical_significance,
        differential_impact: matchedSign.likelihood_ratio_positive,
        conditions_affected: matchedSign.conditions.map(condition => ({
          condition: condition,
          probability_change: this.calculateProbabilityChange(matchedSign.likelihood_ratio_positive)
        })),
        recommended_follow_up: [
          `Confirmar técnica: ${matchedSign.technique}`,
          `Investigar condições: ${matchedSign.conditions.join(', ')}`
        ]
      };
    }
    
    // Generic interpretation for non-specific findings
    return {
      finding: finding,
      clinical_significance: "Achado clínico que requer correlação com quadro geral",
      differential_impact: 1.0,
      conditions_affected: [],
      recommended_follow_up: [
        "Correlacionar com sintomas relatados",
        "Considerar investigação adicional se persistente"
      ]
    };
  }

  /**
   * Check for clinical syndrome patterns
   */
  checkForClinicalSyndromes(
    symptoms: string[],
    physicalFindings: string[]
  ): { syndrome: ClinicalSyndrome; confidence: number }[] {
    
    const allFindings = [...symptoms, ...physicalFindings].map(f => f.toLowerCase());
    const matchedSyndromes: { syndrome: ClinicalSyndrome; confidence: number }[] = [];
    
    Object.values(this.clinicalSyndromes).forEach(syndrome => {
      let majorMatches = 0;
      let minorMatches = 0;
      
      // Count major criteria matches
      syndrome.major_criteria.forEach(criteria => {
        if (allFindings.some(finding => 
          finding.includes(criteria.toLowerCase()) || 
          criteria.toLowerCase().includes(finding)
        )) {
          majorMatches++;
        }
      });
      
      // Count minor criteria matches
      syndrome.minor_criteria.forEach(criteria => {
        if (allFindings.some(finding => 
          finding.includes(criteria.toLowerCase()) || 
          criteria.toLowerCase().includes(finding)
        )) {
          minorMatches++;
        }
      });
      
      // Calculate confidence based on diagnostic rule
      let confidence = 0;
      if (syndrome.diagnostic_rule.includes("2 critérios maiores") && majorMatches >= 2) {
        confidence = Math.min(0.9, 0.3 + (majorMatches * 0.2) + (minorMatches * 0.1));
      } else if (syndrome.diagnostic_rule.includes("1 maior + 2 menores") && majorMatches >= 1 && minorMatches >= 2) {
        confidence = Math.min(0.8, 0.2 + (majorMatches * 0.2) + (minorMatches * 0.1));
      }
      
      if (confidence > 0.3) {
        matchedSyndromes.push({ syndrome, confidence });
      }
    });
    
    return matchedSyndromes.sort((a, b) => b.confidence - a.confidence);
  }

  // Helper methods for symptom categorization
  private isCardiovascularSymptom(symptom: string): boolean {
    const cardioTerms = ['dor no peito', 'palpitação', 'falta de ar', 'edema', 'cansaço', 'fadiga', 'tonteira'];
    return cardioTerms.some(term => symptom.includes(term));
  }

  private isPulmonarySymptom(symptom: string): boolean {
    const pulmonaryTerms = ['tosse', 'falta de ar', 'chiado', 'dor torácica', 'expectoração'];
    return pulmonaryTerms.some(term => symptom.includes(term));
  }

  private isAbdominalSymptom(symptom: string): boolean {
    const abdominalTerms = ['dor abdominal', 'náusea', 'vômito', 'diarreia', 'constipação', 'distensão'];
    return abdominalTerms.some(term => symptom.includes(term));
  }

  private isNeurologicalSymptom(symptom: string): boolean {
    const neuroTerms = ['dor de cabeça', 'tontura', 'fraqueza', 'formigamento', 'confusão', 'convulsão'];
    return neuroTerms.some(term => symptom.includes(term));
  }

  private calculateProbabilityChange(likelihoodRatio: number): number {
    // Simplified calculation of probability change based on likelihood ratio
    if (likelihoodRatio > 10) return 80;
    if (likelihoodRatio > 5) return 60;
    if (likelihoodRatio > 2) return 30;
    if (likelihoodRatio > 1) return 15;
    return 0;
  }
}

export const semiologicalKnowledge = new SemiologicalKnowledge();