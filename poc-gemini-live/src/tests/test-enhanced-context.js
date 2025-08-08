/**
 * Test Enhanced Context Generation
 * Shows how the new buildComprehensivePrompt formats differential diagnoses
 */

// Simulate a complete medical context with enhanced synthesis
const mockContext = {
    clinical_reasoning: "Paciente feminina de 72 anos com quadro de insuficiência cardíaca descompensada em contexto de diabetes mellitus. A apresentação clínica com dispneia aos pequenos esforços e edema de membros inferiores é consistente com descompensação cardíaca.",
    
    synthesis: {
        primary_diagnosis: {
            condition: "Insuficiência Cardíaca Descompensada (ICD)",
            confidence: 0.95,
            reasoning: "A paciente apresenta dispneia aos pequenos esforços e edema de membros inferiores, sintomas clássicos de ICD. A idade avançada (72 anos) e a presença de Diabetes Mellitus são fatores de risco estabelecidos."
        },
        
        differential_diagnoses: [
            {
                condition: "Cardiomiopatia Diabética",
                probability: 0.75,
                reasoning: "Diabetes de longa data pode causar cardiomiopatia específica com disfunção ventricular",
                distinguishing_features: "Início mais insidioso, menor resposta a diuréticos, presença de neuropatia diabética concomitante"
            },
            {
                condition: "Insuficiência Renal Diabética",
                probability: 0.45,
                reasoning: "Diabetes pode causar nefropatia que contribui para retenção hídrica e edema",
                distinguishing_features: "Proteinúria significativa, elevação de creatinina, edema predominante em face"
            },
            {
                condition: "Embolia Pulmonar",
                probability: 0.25,
                reasoning: "Idade avançada e imobilidade são fatores de risco para TEP",
                distinguishing_features: "Dispneia súbita, dor torácica pleurítica, D-dímero elevado"
            }
        ],
        
        supporting_findings: [
            "Dispneia aos pequenos esforços (NYHA III)",
            "Edema bilateral de membros inferiores",
            "História de Diabetes Mellitus",
            "Idade avançada (72 anos)",
            "Sexo feminino com fatores de risco cardiovascular"
        ],
        
        excluding_findings: [
            "Ausência de dor torácica pleurítica (contra embolia pulmonar)",
            "Edema bilateral simétrico (contra trombose venosa unilateral)",
            "Início gradual (contra TEP aguda)",
            "Dispneia aos esforços, não súbita (contra pneumonia)"
        ],
        
        clinical_recommendations: {
            immediate_actions: [
                "Avaliação cardiológica urgente",
                "Controle glicêmico rigoroso",
                "Avaliação da função renal"
            ],
            diagnostic_workup: [
                "Ecocardiograma com Doppler",
                "BNP/NT-proBNP",
                "Função renal completa",
                "HbA1c",
                "Radiografia de tórax"
            ],
            red_flags: [
                "Piora súbita da dispneia",
                "Edema pulmonar",
                "Hipotensão",
                "Oligúria",
                "Síncope"
            ],
            follow_up: "Retorno em 7 dias para reavaliação dos sintomas e resposta ao tratamento",
            monitoring: "Peso diário, controle de pressão arterial, glicemia capilar"
        }
    },
    
    references: [
        {
            title: "Heart Failure Management in Diabetic Patients: A Comprehensive Review",
            authors: ["Smith J", "Jones K", "Brown L"],
            journal: "Journal of Cardiology",
            year: 2023,
            source: "pubmed",
            abstract: "Comprehensive review of heart failure management strategies in diabetic patients...",
            open_access: false
        },
        {
            title: "Dyspnea and Edema in Elderly Women with Diabetes: Clinical Outcomes",
            authors: ["Wilson A", "Davis M"],
            journal: "Geriatric Medicine", 
            year: 2024,
            source: "pubmed",
            abstract: "Prospective study analyzing dyspnea and peripheral edema patterns...",
            open_access: true
        }
    ],
    
    processing_summary: "Enhanced MedRAG processed 15 sources with 95.0% confidence",
    processing_time_ms: 14443,
    sources_consulted: 15
};

// Mock the buildComprehensivePrompt function from index.tsx
function buildComprehensivePrompt(context) {
    let prompt = context.clinical_reasoning;
    
    // Adiciona informações da síntese se disponível
    if (context.synthesis) {
        prompt += `\n\n## ANÁLISE DIAGNÓSTICA COMPLETA:\n`;
        
        // Diagnóstico principal com justificativa detalhada
        if (context.synthesis.primary_diagnosis) {
            prompt += `### 🎯 DIAGNÓSTICO MAIS PROVÁVEL:\n`;
            prompt += `**${context.synthesis.primary_diagnosis.condition}** (Confiança: ${(context.synthesis.primary_diagnosis.confidence * 100).toFixed(1)}%)\n\n`;
            prompt += `**Justificativa Clínica:** ${context.synthesis.primary_diagnosis.reasoning}\n\n`;
        }
        
        // Diagnósticos diferenciais organizados por probabilidade
        if (context.synthesis.differential_diagnoses?.length > 0) {
            prompt += `### 🔍 DIAGNÓSTICOS DIFERENCIAIS:\n`;
            
            // Ordena por probabilidade (maior para menor)
            const sortedDifferentials = context.synthesis.differential_diagnoses
                .sort((a, b) => (b.probability || 0) - (a.probability || 0));
            
            sortedDifferentials.forEach((dd, index) => {
                const probability = (dd.probability * 100).toFixed(1);
                prompt += `**${index + 1}. ${dd.condition}** (Probabilidade: ${probability}%)\n`;
                prompt += `   📋 Justificativa: ${dd.reasoning}\n`;
                
                // Adiciona achados diferenciadores se disponível
                if (dd.distinguishing_features) {
                    prompt += `   🔬 Achados diferenciadores: ${dd.distinguishing_features}\n`;
                }
                prompt += `\n`;
            });
            
            // Análise comparativa - por que o diagnóstico principal é mais provável
            if (context.synthesis.primary_diagnosis && sortedDifferentials.length > 0) {
                prompt += `### 💡 ANÁLISE COMPARATIVA:\n`;
                prompt += `**Por que "${context.synthesis.primary_diagnosis.condition}" é mais provável:**\n`;
                
                // Compara com os principais diferenciais
                const topDifferentials = sortedDifferentials.slice(0, 2);
                topDifferentials.forEach((dd) => {
                    const primaryConfidence = context.synthesis.primary_diagnosis.confidence * 100;
                    const differentialProb = dd.probability * 100;
                    const difference = (primaryConfidence - differentialProb).toFixed(1);
                    
                    prompt += `• **vs ${dd.condition}:** ${difference}% maior probabilidade devido aos achados clínicos mais consistentes com o quadro apresentado\n`;
                });
                prompt += `\n`;
            }
        }
        
        // Achados clínicos que suportam/refutam diagnósticos
        if (context.synthesis.supporting_findings || context.synthesis.excluding_findings) {
            prompt += `### 📊 ACHADOS CLÍNICOS RELEVANTES:\n`;
            
            if (context.synthesis.supporting_findings?.length > 0) {
                prompt += `**Achados que SUPORTAM o diagnóstico principal:**\n`;
                context.synthesis.supporting_findings.forEach((finding) => {
                    prompt += `✅ ${finding}\n`;
                });
                prompt += `\n`;
            }
            
            if (context.synthesis.excluding_findings?.length > 0) {
                prompt += `**Achados que EXCLUEM diagnósticos diferenciais:**\n`;
                context.synthesis.excluding_findings.forEach((finding) => {
                    prompt += `❌ ${finding}\n`;
                });
                prompt += `\n`;
            }
        }
        
        // Recomendações clínicas organizadas
        if (context.synthesis.clinical_recommendations) {
            const recs = context.synthesis.clinical_recommendations;
            prompt += `### 📋 CONDUTA CLÍNICA:\n`;
            
            if (recs.immediate_actions?.length > 0) {
                prompt += `**🚨 Ações Imediatas:**\n`;
                recs.immediate_actions.forEach((action) => {
                    prompt += `• ${action}\n`;
                });
                prompt += `\n`;
            }
            
            if (recs.diagnostic_workup?.length > 0) {
                prompt += `**🔬 Propedêutica Diagnóstica:**\n`;
                recs.diagnostic_workup.forEach((exam) => {
                    prompt += `• ${exam}\n`;
                });
                prompt += `\n`;
            }
            
            if (recs.red_flags?.length > 0) {
                prompt += `**⚠️ Sinais de Alarme:**\n`;
                recs.red_flags.forEach((flag) => {
                    prompt += `🚩 ${flag}\n`;
                });
                prompt += `\n`;
            }
            
            // Monitoramento e seguimento
            if (recs.follow_up || recs.monitoring) {
                prompt += `**📅 Monitoramento e Seguimento:**\n`;
                if (recs.follow_up) prompt += `• Seguimento: ${recs.follow_up}\n`;
                if (recs.monitoring) prompt += `• Monitoramento: ${recs.monitoring}\n`;
                prompt += `\n`;
            }
        }
    }
    
    // Adiciona informações das referências científicas
    if (context.references.length > 0) {
        prompt += `\n\n## EVIDÊNCIAS CIENTÍFICAS (${context.references.length} estudos):\n`;
        context.references.forEach((ref, index) => {
            prompt += `${index + 1}. **${ref.title}** (${ref.journal}, ${ref.year})\n`;
            prompt += `   Autores: ${ref.authors.slice(0, 3).join(', ')}${ref.authors.length > 3 ? ' et al.' : ''}\n`;
            if (ref.abstract) {
                prompt += `   Resumo: ${ref.abstract.substring(0, 200)}...\n`;
            }
            prompt += `   Fonte: ${ref.source.toUpperCase()} | Acesso: ${ref.open_access ? 'Aberto' : 'Restrito'}\n\n`;
        });
    }
    
    // Adiciona resumo de processamento
    prompt += `\n## METADADOS DO PROCESSAMENTO:\n`;
    prompt += `- ${context.processing_summary}\n`;
    prompt += `- Tempo de processamento: ${context.processing_time_ms}ms\n`;
    
    return prompt;
}

console.log('🧠 === TESTE DO CONTEXTO MÉDICO APRIMORADO ===\n');

const enhancedContext = buildComprehensivePrompt(mockContext);

console.log('📋 CONTEXTO MÉDICO COMPLETO GERADO:');
console.log('='.repeat(80));
console.log(enhancedContext);
console.log('='.repeat(80));

console.log(`\n📊 ESTATÍSTICAS DO CONTEXTO:`);
console.log(`  📏 Tamanho total: ${enhancedContext.length} caracteres`);
console.log(`  🎯 Diagnóstico principal: ${mockContext.synthesis.primary_diagnosis.condition}`);
console.log(`  🔍 Diagnósticos diferenciais: ${mockContext.synthesis.differential_diagnoses.length}`);
console.log(`  ✅ Achados suportivos: ${mockContext.synthesis.supporting_findings.length}`);
console.log(`  ❌ Achados excludentes: ${mockContext.synthesis.excluding_findings.length}`);
console.log(`  📚 Referências científicas: ${mockContext.references.length}`);

console.log(`\n✅ CONTEXTO APRIMORADO CRIADO COM SUCESSO!`);
console.log(`🎯 Agora inclui diagnósticos diferenciais, achados diferenciadores e análise comparativa.`);