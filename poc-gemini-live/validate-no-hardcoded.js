/**
 * Validation script to check if hardcoded patterns were removed
 */

import fs from 'fs';

const filesToCheck = [
    'semantic-medical-extractor.ts',
    'medical-analyzer.ts',
    'physician-medical-analyzer.ts'
];

console.log('🔍 === VALIDAÇÃO: REMOÇÃO DE PADRÕES HARDCODED ===\n');

let totalHardcodedFound = 0;

for (const file of filesToCheck) {
    console.log(`📄 Verificando: ${file}`);
    
    try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Padrões que indicam hardcoded
        const hardcodedPatterns = [
            /symptomKeywords.*=/,
            /medicalPatterns.*=/,
            /pattern:\s*\/.*\/g/,
            /private readonly.*Keywords.*=/,
            /initializeMedicalPatterns/,
            /extractUsingPatternFallback/,
            /\['febre', 'dor'/,
            /regex.*medical/i
        ];
        
        let fileHardcodedCount = 0;
        
        for (const pattern of hardcodedPatterns) {
            const matches = content.match(new RegExp(pattern.source, 'g'));
            if (matches) {
                fileHardcodedCount += matches.length;
                console.log(`  ⚠️  Encontrado padrão hardcoded: ${pattern.source} (${matches.length}x)`);
            }
        }
        
        if (fileHardcodedCount === 0) {
            console.log(`  ✅ Nenhum padrão hardcoded encontrado`);
        } else {
            console.log(`  ❌ Total de padrões hardcoded: ${fileHardcodedCount}`);
        }
        
        totalHardcodedFound += fileHardcodedCount;
        
    } catch (error) {
        console.log(`  💥 Erro ao ler arquivo: ${error.message}`);
    }
    
    console.log('');
}

console.log('📊 === RESULTADO FINAL ===');
if (totalHardcodedFound === 0) {
    console.log('🎉 SUCESSO: Nenhum padrão hardcoded encontrado!');
    console.log('✅ Sistema agora usa extração puramente semântica');
} else {
    console.log(`❌ ATENÇÃO: ${totalHardcodedFound} padrões hardcoded ainda encontrados`);
    console.log('🔧 Necessário continuar a remoção');
}

// Verificar se métodos semânticos estão presentes
console.log('\n🧠 === VERIFICAÇÃO DE MÉTODOS SEMÂNTICOS ===');

for (const file of filesToCheck) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        
        const semanticIndicators = [
            /semanticMedicalExtractor/,
            /billingualElasticsearchRAG/,
            /extractMedicalEntities/,
            /semantic.*search/i,
            /embedding/i
        ];
        
        let semanticMethodsFound = 0;
        
        for (const indicator of semanticIndicators) {
            if (indicator.test(content)) {
                semanticMethodsFound++;
            }
        }
        
        console.log(`📄 ${file}: ${semanticMethodsFound} métodos semânticos encontrados`);
        
    } catch (error) {
        console.log(`💥 Erro: ${error.message}`);
    }
}

console.log('\n✅ Validação concluída!');