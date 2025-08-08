/**
 * Physician Prompt Templates
 * Specialized prompt templates for different medical scenarios
 */

import { semiologicalKnowledge } from './semiological-knowledge';

interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables: string[];
}

export class PhysicianPromptTemplates {
  
  private templates: { [key: string]: PromptTemplate } = {
    
    differential_diagnosis: {
      name: "Diagnóstico Diferencial",
      description: "Template para análise de diagnóstico diferencial",
      variables: ["symptoms", "physical_findings", "patient_context", "elasticsearch_context"],
      template: `
## 🔬 DIAGNÓSTICO DIFERENCIAL SOLICITADO

**Apresentação clínica:** {symptoms}
${"{physical_findings}" ? "**Achados físicos:** {physical_findings}" : ""}
**Contexto do paciente:** {patient_context}

### 📊 CONTEXTO MÉDICO DISPONÍVEL:
{elasticsearch_context}

**COMO CONSULTOR MÉDICO SÊNIOR, forneça análise diagnóstica estruturada:**

#### 1. DIAGNÓSTICO DIFERENCIAL BAYESIANO:
Para cada diagnóstico, calcule e apresente:
- **Probabilidade pré-teste** (prevalência na população brasileira)
- **Likelihood ratio** dos sintomas/achados presentes
- **Probabilidade pós-teste** resultante
- **Formato:** "• Condição X (Y%): Justificativa clínica + exames confirmatórios"

#### 2. ESTRATIFICAÇÃO POR PROBABILIDADE E GRAVIDADE:
- **ALTA PROBABILIDADE (>60%):** Diagnósticos mais prováveis
- **MÉDIA PROBABILIDADE (20-60%):** Diagnósticos a considerar
- **BAIXA PROBABILIDADE (<20%):** Diagnósticos a descartar apenas se alto risco

#### 3. PLANO DIAGNÓSTICO ESCALONADO:
- **Primeira linha:** Exames básicos/screening (ECG, RX, laboratório básico)
- **Segunda linha:** Exames confirmatórios específicos
- **Terceira linha:** Exames especializados (se primeira linha inconclusiva)

#### 4. PONTOS DE DECISÃO CRÍTICOS:
- Achados que, se presentes, mudam significativamente as probabilidades
- Sinais de alarme que indicam investigação urgente
- Critérios para encaminhamento especializado

**RESPONDA DE FORMA ESTRUTURADA PARA TOMADA DE DECISÃO CLÍNICA IMEDIATA.**
`
    },

    physical_examination_guidance: {
      name: "Orientação de Exame Físico",
      description: "Template para orientar exame físico direcionado",
      variables: ["symptoms", "differential_diagnoses", "patient_age", "patient_comorbidities"],
      template: `
## 🩺 ORIENTAÇÃO DE EXAME FÍSICO DIRECIONADO

**Sintomas apresentados:** {symptoms}
**Hipóteses diagnósticas:** {differential_diagnoses}
**Idade do paciente:** {patient_age}
**Comorbidades:** {patient_comorbidities}

**COMO ESPECIALISTA EM SEMIOLOGIA MÉDICA, oriente exame físico específico:**

### 🎯 SISTEMAS PRIORITÁRIOS A EXAMINAR:
Baseado nos sintomas e hipóteses, priorize:

### 📋 PROTOCOLO DE EXAME ESTRUTURADO:

#### INSPEÇÃO GERAL:
- Aspectos específicos a observar para as hipóteses em questão
- Sinais de gravidade ou instabilidade
- Padrões dismórficos ou característicos

#### EXAME FÍSICO SEGMENTAR:
Para cada sistema relevante:
- **INSPEÇÃO:** O que observar especificamente
- **PALPAÇÃO:** Técnicas e pontos-chave
- **PERCUSSÃO:** Áreas prioritárias e achados esperados
- **AUSCULTA:** Focos e características a avaliar

#### MANOBRAS SEMIOLÓGICAS ESPECÍFICAS:
- Nome da manobra + técnica detalhada
- Interpretação: resultado positivo vs negativo
- Sensibilidade/especificidade quando conhecida
- Valor para as hipóteses diagnósticas em questão

### ⚠️ ACHADOS QUE MUDAM PROBABILIDADES:
- **Se encontrar X:** probabilidade de Y muda para Z%
- **Combinações importantes:** achados que formam padrões/síndromes
- **Red flags:** achados que indicam urgência

### 🎯 SEQUÊNCIA RECOMENDADA:
1. Exame geral e sinais vitais
2. Foco no sistema mais provável
3. Manobras específicas para diferenciação
4. Avaliação de complicações

**FORNEÇA ORIENTAÇÕES PRÁTICAS PARA EXECUÇÃO IMEDIATA.**
`
    },

    clinical_finding_interpretation: {
      name: "Interpretação de Achado Clínico",
      description: "Template para interpretar achados do exame físico",
      variables: ["clinical_finding", "examination_technique", "patient_context", "associated_symptoms"],
      template: `
## 🧩 INTERPRETAÇÃO DE ACHADO CLÍNICO

**Achado relatado:** {clinical_finding}
**Técnica utilizada:** {examination_technique}
**Contexto clínico:** {patient_context}
**Sintomas associados:** {associated_symptoms}

**COMO ESPECIALISTA EM SEMIOLOGIA, forneça análise detalhada:**

### ✅ VALIDAÇÃO DO ACHADO:
- **Técnica correta?** Verificar se a metodologia está adequada
- **Achado confiável?** Fatores que podem causar falso-positivo/negativo
- **Necessita confirmação?** Quando repetir ou usar técnica alternativa

### 🔬 SIGNIFICADO CLÍNICO:
- **Interpretação fisiopatológica:** Mecanismo do achado
- **Especificidade:** Quão específico é para determinadas condições
- **Sensibilidade:** Frequência em que aparece nas condições relevantes

### 📊 IMPACTO DIAGNÓSTICO:
- **Likelihood ratio:** {likelihood_ratio} (se conhecido)
- **Mudança de probabilidade:** Como afeta as hipóteses diagnósticas
- **Valor discriminatório:** Capacidade de diferenciar condições

### 🎯 DIAGNÓSTICOS COMPATÍVEIS:
Priorizado por probabilidade:
- **Muito provável (>70%):** Condições altamente sugestivas
- **Provável (40-70%):** Condições compatíveis
- **Possível (10-40%):** Condições a considerar

### 📋 PRÓXIMOS PASSOS:
- **Achados complementares:** Outros sinais/sintomas a investigar
- **Exames adicionais:** Testes para confirmação
- **Correlações necessárias:** Dados clínicos/laboratoriais

### ⚠️ ALERTAS CLÍNICOS:
- **Gravidade:** Indica condição grave?
- **Urgência:** Requer ação imediata?
- **Seguimento:** Critérios para reavaliação

**INTEGRE O ACHADO NO CONTEXTO CLÍNICO GLOBAL.**
`
    },

    drug_interaction_analysis: {
      name: "Análise de Interação Medicamentosa",
      description: "Template para verificar interações medicamentosas",
      variables: ["medications", "patient_age", "patient_comorbidities", "renal_function", "hepatic_function"],
      template: `
## 💊 ANÁLISE DE INTERAÇÕES MEDICAMENTOSAS

**Medicamentos em uso:** {medications}
**Idade:** {patient_age}
**Comorbidades:** {patient_comorbidities}
**Função renal:** {renal_function}
**Função hepática:** {hepatic_function}

**COMO FARMACOLOGISTA CLÍNICO, analise interações e ajustes:**

### 🚨 INTERAÇÕES IDENTIFICADAS:

#### INTERAÇÕES MAIORES (Contraindicação/Evitar):
- **Medicamento A + B:** Mecanismo + consequência clínica
- **Recomendação:** Suspender/substituir + alternativa terapêutica

#### INTERAÇÕES MODERADAS (Monitoramento):
- **Medicamento C + D:** Mecanismo + efeito esperado
- **Recomendação:** Monitoramento específico + parâmetros

#### INTERAÇÕES MENORES (Atenção):
- **Medicamento E + F:** Efeito potencial
- **Recomendação:** Orientação ao paciente

### ⚖️ AJUSTES DE DOSE NECESSÁRIOS:

#### FUNÇÃO RENAL:
- **Se TFG < 60:** Ajustes específicos
- **Se TFG < 30:** Precauções especiais
- **Diálise:** Considerações especiais

#### FUNÇÃO HEPÁTICA:
- **Child-Pugh A/B/C:** Ajustes por gravidade
- **Metabolismo hepático:** Medicamentos afetados

#### IDADE:
- **Idosos (>65 anos):** Critérios de Beers, redução de dose
- **Farmacocinética alterada:** Considerações especiais

### 🔄 ALTERNATIVAS TERAPÊUTICAS:
Para interações problemáticas:
- **Substituição por:** Medicamento equivalente sem interação
- **Posologia alternativa:** Horários diferentes, doses ajustadas
- **Monitoramento:** Parâmetros laboratoriais específicos

### 📊 PROTOCOLO DE MONITORAMENTO:
- **Parâmetros clínicos:** Sinais e sintomas a observar
- **Exames laboratoriais:** Frequência e valores-alvo
- **Tempo de reavaliação:** Quando reavaliar as medicações

### 🎯 ORIENTAÇÕES PRÁTICAS:
- **Para o médico:** Precauções na prescrição
- **Para o paciente:** Sinais de alerta, horários
- **Para o farmacêutico:** Orientações de dispensação

**PRIORIZE SEGURANÇA DO PACIENTE E EFICÁCIA TERAPÊUTICA.**
`
    },

    emergency_triage: {
      name: "Triagem de Emergência",
      description: "Template para triagem e manejo de emergências",
      variables: ["presenting_symptoms", "vital_signs", "patient_age", "comorbidities", "time_of_onset"],
      template: `
## 🚨 TRIAGEM DE EMERGÊNCIA MÉDICA

**Sintomas de apresentação:** {presenting_symptoms}
**Sinais vitais:** {vital_signs}
**Idade:** {patient_age}
**Comorbidades:** {comorbidities}
**Tempo de início:** {time_of_onset}

**COMO EMERGENCISTA EXPERIENTE, realize triagem estruturada:**

### ⚡ CLASSIFICAÇÃO DE URGÊNCIA:

#### 🔴 EMERGÊNCIA (0-15 minutos):
Condições que requerem intervenção IMEDIATA:
- **Critérios identificados:** [Listar se presentes]
- **Ação imediata:** Medidas de suporte vital
- **Protocolos:** ACLS, ATLS conforme indicado

#### 🟠 URGÊNCIA (15-60 minutos):
Condições que requerem avaliação URGENTE:
- **Critérios identificados:** [Listar se presentes]
- **Ação:** Avaliação médica prioritária
- **Monitoramento:** Parâmetros específicos

#### 🟡 SEMI-URGENTE (1-4 horas):
Condições estáveis que precisam investigação:
- **Critérios identificados:** [Listar se presentes]
- **Ação:** Avaliação médica programada

#### 🟢 NÃO-URGENTE (>4 horas):
Condições que podem aguardar:
- **Critérios:** Sintomas leves, estável
- **Ação:** Orientação e seguimento ambulatorial

### 🎯 DIAGNÓSTICOS DIFERENCIAIS POR URGÊNCIA:

#### MUST RULE OUT (Descartar obrigatoriamente):
- **Condições fatais:** IAM, AVC, embolia pulmonar, sepse
- **Exames STAT:** ECG, troponina, gasometria, lactato
- **Tempo crítico:** Janela terapêutica para cada condição

#### PROVÁVEIS:
- **Diagnósticos mais prováveis** baseados na apresentação
- **Exames de apoio:** Laboratório e imagem prioritários

### 📋 PROTOCOLO DE AÇÃO IMEDIATA:

#### ABCDE (Primary Survey):
- **A - Airway:** Via aérea pérvia?
- **B - Breathing:** Ventilação adequada?
- **C - Circulation:** Perfusão adequada?
- **D - Disability:** Função neurológica?
- **E - Exposure:** Exame completo/temperatura

#### MEDIDAS DE SUPORTE:
- **Oxigenação:** O2 se SatO2 < 94%
- **Acesso vascular:** Calibre adequado
- **Monitorização:** ECG, PA, FC, SatO2
- **Posicionamento:** Otimizar conforto/função

### ⚠️ RED FLAGS IDENTIFICADOS:
- **Sinais de instabilidade:** [Listar se presentes]
- **Critérios de gravidade:** Escores de risco aplicáveis
- **Tempo crítico:** Janelas terapêuticas relevantes

### 🚑 CRITÉRIOS DE ACIONAMENTO:
- **SAMU:** Quando chamar transporte especializado
- **UTI:** Critérios de admissão em terapia intensiva
- **Especialista:** Urgência de interconsulta

**PRIORIZE IDENTIFICAÇÃO E ESTABILIZAÇÃO DE CONDIÇÕES AMEAÇADORAS À VIDA.**
`
    },

    treatment_guidance: {
      name: "Orientação Terapêutica",
      description: "Template para orientações de tratamento",
      variables: ["diagnosis", "patient_profile", "comorbidities", "contraindications", "treatment_goals"],
      template: `
## 💊 ORIENTAÇÃO TERAPÊUTICA BASEADA EM EVIDÊNCIAS

**Diagnóstico:** {diagnosis}
**Perfil do paciente:** {patient_profile}
**Comorbidades:** {comorbidities}
**Contraindicações:** {contraindications}
**Objetivos do tratamento:** {treatment_goals}

**COMO ESPECIALISTA EM MEDICINA BASEADA EM EVIDÊNCIAS:**

### 🎯 ESTRATÉGIA TERAPÊUTICA:

#### OBJETIVOS ESPECÍFICOS:
- **Primário:** Meta principal do tratamento
- **Secundários:** Objetivos complementares
- **Qualidade de vida:** Impacto esperado
- **Prognóstico:** Melhora esperada

#### EVIDÊNCIAS ATUAIS:
- **Guidelines nacionais:** Diretrizes SBC, SBEM, AMB
- **Guidelines internacionais:** ESC, AHA, ADA
- **Nível de evidência:** Grau A/B/C das recomendações
- **Estudos recentes:** Mudanças na prática baseadas em evidências

### 📋 PLANO TERAPÊUTICO ESCALONADO:

#### PRIMEIRA LINHA:
- **Medicamento:** Nome genérico (DCB)
- **Posologia:** Dose inicial + ajustes
- **Duração:** Tempo de tratamento
- **Monitoramento:** Parâmetros de eficácia/segurança

#### SEGUNDA LINHA:
- **Indicação:** Quando usar (falha/intolerância primeira linha)
- **Alternativas:** Opções terapêuticas
- **Combinações:** Quando associar medicamentos

#### TRATAMENTO ADJUVANTE:
- **Medidas não-farmacológicas:** Dieta, exercício, mudanças comportamentais
- **Suporte:** Orientações específicas
- **Seguimento:** Frequência de reavaliação

### ⚖️ PERSONALIZAÇÃO TERAPÊUTICA:

#### AJUSTES POR COMORBIDADES:
- **Insuficiência renal:** Ajustes de dose específicos
- **Insuficiência hepática:** Precauções especiais
- **Diabetes:** Interações com hipoglicemiantes
- **Hipertensão:** Combinações benéficas/prejudiciais

#### AJUSTES POR IDADE:
- **Idosos:** Critérios de Beers, start low/go slow
- **Adultos jovens:** Considerações especiais
- **Mulheres em idade fértil:** Teratogenicidade

### 📊 MONITORAMENTO TERAPÊUTICO:

#### EFICÁCIA:
- **Parâmetros clínicos:** Melhora sintomática esperada
- **Exames laboratoriais:** Marcadores de eficácia
- **Tempo para resposta:** Quando esperar melhora

#### SEGURANÇA:
- **Efeitos adversos:** Mais comuns e graves
- **Exames de monitoramento:** Frequência recomendada
- **Sinais de alerta:** Quando suspender/ajustar

### 🚨 CRITÉRIOS DE AJUSTE/SUSPENSÃO:
- **Melhora insuficiente:** Quando modificar
- **Efeitos adversos:** Critérios para suspensão
- **Interações:** Quando revisar esquema

### 🎓 ORIENTAÇÕES AO PACIENTE:
- **Adesão:** Importância do uso correto
- **Sinais de melhora:** O que esperar
- **Sinais de alerta:** Quando procurar ajuda
- **Seguimento:** Próximas consultas

**BASEIE TODAS AS RECOMENDAÇÕES EM EVIDÊNCIAS CIENTÍFICAS ATUAIS.**
`
    }
  };

  /**
   * Generate prompt based on scenario and variables
   */
  generatePrompt(
    scenario: string,
    variables: { [key: string]: string }
  ): string {
    
    const template = this.templates[scenario];
    if (!template) {
      throw new Error(`Template not found for scenario: ${scenario}`);
    }

    let prompt = template.template;
    
    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value || 'Não informado');
    });

    return prompt;
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): { [key: string]: { name: string; description: string; variables: string[] } } {
    const result: { [key: string]: { name: string; description: string; variables: string[] } } = {};
    
    Object.entries(this.templates).forEach(([key, template]) => {
      result[key] = {
        name: template.name,
        description: template.description,
        variables: template.variables
      };
    });
    
    return result;
  }

  /**
   * Auto-detect scenario based on input text
   */
  detectScenario(inputText: string): string {
    const lowerText = inputText.toLowerCase();
    
    // Emergency scenarios
    if (this.containsEmergencyKeywords(lowerText)) {
      return 'emergency_triage';
    }
    
    // Physical examination
    if (this.containsPhysicalExamKeywords(lowerText)) {
      return 'physical_examination_guidance';
    }
    
    // Clinical findings
    if (this.containsClinicalFindingKeywords(lowerText)) {
      return 'clinical_finding_interpretation';
    }
    
    // Drug interactions
    if (this.containsDrugKeywords(lowerText)) {
      return 'drug_interaction_analysis';
    }
    
    // Treatment requests
    if (this.containsTreatmentKeywords(lowerText)) {
      return 'treatment_guidance';
    }
    
    // Default to differential diagnosis
    return 'differential_diagnosis';
  }

  /**
   * Generate comprehensive physician prompt with semiological integration
   */
  generatePhysicianPromptWithSemiology(
    scenario: string,
    variables: { [key: string]: string },
    symptoms: string[] = [],
    physicalFindings: string[] = []
  ): string {
    
    // Generate base prompt
    const basePrompt = this.generatePrompt(scenario, variables);
    
    // Add semiological context if relevant
    if (symptoms.length > 0 || physicalFindings.length > 0) {
      const semiologyContext = this.generateSemiologyContext(symptoms, physicalFindings);
      
      return `${basePrompt}

## 🩺 CONTEXTO SEMIOLÓGICO INTEGRADO:
${semiologyContext}

**INSTRUÇÕES SEMIOLÓGICAS ADICIONAIS:**
- Correlacione sintomas com achados físicos esperados
- Use likelihood ratios para calcular probabilidades pós-teste
- Identifique padrões sindrômicos quando presentes
- Sugira manobras específicas para diferenciação diagnóstica
- Aplique conhecimento de sensibilidade/especificidade dos achados
`;
    }
    
    return basePrompt;
  }

  /**
   * Generate semiological context
   */
  private generateSemiologyContext(symptoms: string[], physicalFindings: string[]): string {
    const recommendations = semiologicalKnowledge.generateExaminationRecommendations(symptoms, []);
    const syndromes = semiologicalKnowledge.checkForClinicalSyndromes(symptoms, physicalFindings);
    
    let context = '';
    
    if (recommendations.priority_systems.length > 0) {
      context += `### SISTEMAS PRIORITÁRIOS A EXAMINAR:\n`;
      context += recommendations.priority_systems.map(system => `• ${system}`).join('\n') + '\n\n';
    }
    
    if (recommendations.recommended_maneuvers.length > 0) {
      context += `### MANOBRAS SEMIOLÓGICAS RECOMENDADAS:\n`;
      context += recommendations.recommended_maneuvers.slice(0, 5).map(maneuver => `• ${maneuver}`).join('\n') + '\n\n';
    }
    
    if (recommendations.specific_signs_to_check.length > 0) {
      context += `### SINAIS ESPECÍFICOS A INVESTIGAR:\n`;
      recommendations.specific_signs_to_check.slice(0, 3).forEach(sign => {
        context += `• **${sign.name}**: ${sign.description} (LR+ = ${sign.likelihood_ratio_positive})\n`;
      });
      context += '\n';
    }
    
    if (syndromes.length > 0) {
      context += `### SÍNDROMES CLÍNICAS POSSÍVEIS:\n`;
      syndromes.slice(0, 2).forEach(item => {
        context += `• **${item.syndrome.name}** (Confiança: ${(item.confidence * 100).toFixed(0)}%)\n`;
      });
    }
    
    return context || 'Aplique conhecimento semiológico geral baseado nos sintomas relatados.';
  }

  // Helper methods for scenario detection
  private containsEmergencyKeywords(text: string): boolean {
    const emergencyKeywords = ['emergência', 'urgente', 'samu', 'crítico', 'instável', 'choque', 'parada'];
    return emergencyKeywords.some(keyword => text.includes(keyword));
  }

  private containsPhysicalExamKeywords(text: string): boolean {
    const examKeywords = ['exame físico', 'palpação', 'ausculta', 'percussão', 'inspeção', 'manobra'];
    return examKeywords.some(keyword => text.includes(keyword));
  }

  private containsClinicalFindingKeywords(text: string): boolean {
    const findingKeywords = ['sopro', 'galope', 'estertores', 'sinal de', 'encontrei', 'ausculto', 'palpo'];
    return findingKeywords.some(keyword => text.includes(keyword));
  }

  private containsDrugKeywords(text: string): boolean {
    const drugKeywords = ['medicamento', 'interação', 'dose', 'posologia', 'efeito colateral', 'contraindicação'];
    return drugKeywords.some(keyword => text.includes(keyword));
  }

  private containsTreatmentKeywords(text: string): boolean {
    const treatmentKeywords = ['como tratar', 'tratamento', 'protocolo', 'conduta', 'terapêutica', 'medicação'];
    return treatmentKeywords.some(keyword => text.includes(keyword));
  }
}

export const physicianPromptTemplates = new PhysicianPromptTemplates();