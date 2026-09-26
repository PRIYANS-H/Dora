import os
import re

DIR = r"k:\stuff\Dora\frontend\src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Base layout background (main, section)
    content = content.replace("bg-[#0b0c10]", "bg-transparent")
    content = content.replace("bg-[#090b0e]", "bg-transparent")
    
    # Cards / inputs
    content = content.replace("bg-gray-950", "lp-glass-input")
    content = content.replace("border-gray-800", "border-white/20")
    
    # Primary Buttons
    content = content.replace("bg-amber-400", "lp-glass-button")
    content = content.replace("hover:bg-amber-300", "hover:bg-white/10")
    content = content.replace("focus:border-amber-400", "focus:border-white")
    content = content.replace("hover:border-amber-400", "hover:border-white")
    content = content.replace("text-gray-950", "") 
    
    # Text colors
    content = content.replace("text-amber-400", "text-white")
    content = content.replace("text-amber-300", "text-gray-300")
    content = content.replace("hover:text-amber-200", "hover:text-white")
    content = content.replace("text-emerald-300", "text-green-300")
    
    content = content.replace("accent-amber-400", "accent-white")
    content = content.replace("glass-card", "lp-glass-panel")
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

for root, _, files in os.walk(DIR):
    for file in files:
        if file.endswith('.jsx'):
            process_file(os.path.join(root, file))

print("UI replaced")
