"""
Script para converter um arquivo de texto com dados separados por tabulação em um arquivo JSON.

O arquivo de texto deve conter duas colunas separadas por tabulação, onde a primeira coluna
representa o valor "de" e a segunda coluna representa o valor "para".

O script irá ler o arquivo de texto, processar os dados e salvar o resultado em um arquivo JSON.

Como usar:
1. Salve seus dados em um arquivo de texto (.txt) com valores separados por tabulação
2. Execute o script passando o caminho do arquivo como parâmetro:
   python converter.py caminho/para/seu/arquivo.txt
   
   Se nenhum caminho for fornecido, o script usará 'Novo Documento de Texto.txt' como padrão.
   
   O resultado será salvo em 'convertido.json'.
"""

import json
import sys

def main():
    # Get input file path from command line arguments or use default
    input_file = sys.argv[1] if len(sys.argv) > 1 else 'Novo Documento de Texto.txt'
    output_file = 'convertido.json'
    
    # Read the input file
    with open(input_file, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    # Process the data
    data = []
    header = lines[0].strip().split('\t')  # Get header columns

    # Process each line (skipping header)
    for line in lines[1:]:
        values = line.strip().split('\t')
        if len(values) == 2:  # Ensure we have both values
            data.append({
                "de": values[0],
                "para": values[1]
            })

    # Write to JSON file
    with open(output_file, 'w', encoding='utf-8') as json_file:
        json.dump(data, json_file, ensure_ascii=False, indent=2)

    print(f"Conversion completed. Output saved to {output_file}")

if __name__ == "__main__":
    main()