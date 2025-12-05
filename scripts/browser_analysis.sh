#!/bin/bash

# Browser-level analysis using curl + timing

echo "=== BROWSER-LEVEL LOAD ANALYSIS ==="
echo ""

analyze_full_page_load() {
    local domain=$1
    
    echo "Analyzing: https://$domain"
    echo "================================"
    
    # Step 1: Initial HTML
    echo "Step 1: Fetch HTML..."
    START=$(date +%s%N)
    HTML=$(curl -sL "https://$domain" -m 15)
    END=$(date +%s%N)
    HTML_TIME=$(( ($END - $START) / 1000000 ))
    echo "  HTML load: ${HTML_TIME}ms"
    
    # Step 2: Extract all resources
    echo ""
    echo "Step 2: Analyzing resources..."
    
    # JavaScript
    JS_URLS=$(echo "$HTML" | grep -oP '(?<=src=")[^"]*\.js[^"]*' | head -10)
    JS_COUNT=$(echo "$JS_URLS" | grep -c '^')
    
    # CSS
    CSS_URLS=$(echo "$HTML" | grep -oP '(?<=href=")[^"]*\.css[^"]*' | head -10)
    CSS_COUNT=$(echo "$CSS_URLS" | grep -c '^')
    
    echo "  JavaScript files: $JS_COUNT"
    echo "  CSS files: $CSS_COUNT"
    
    # Step 3: Load critical resources
    echo ""
    echo "Step 3: Loading critical resources..."
    
    TOTAL_RESOURCE_TIME=0
    RESOURCE_COUNT=0
    
    # Load first 5 JS files
    while IFS= read -r url; do
        [ -z "$url" ] && continue
        
        # Make absolute URL
        if [[ $url == //* ]]; then
            url="https:$url"
        elif [[ $url == /* ]]; then
            url="https://$domain$url"
        elif [[ ! $url == http* ]]; then
            url="https://$domain/$url"
        fi
        
        START=$(date +%s%N)
        timeout 5 curl -s -o /dev/null "$url" 2>&1
        if [ $? -eq 0 ]; then
            END=$(date +%s%N)
            TIME=$(( ($END - $START) / 1000000 ))
            TOTAL_RESOURCE_TIME=$((TOTAL_RESOURCE_TIME + TIME))
            ((RESOURCE_COUNT++))
            echo "    Loaded resource: ${TIME}ms"
        fi
    done <<< "$(echo "$JS_URLS" | head -5)"
    
    # Calculate total
    TOTAL_TIME=$((HTML_TIME + TOTAL_RESOURCE_TIME))
    
    echo ""
    echo "=== SUMMARY ==="
    echo "  HTML: ${HTML_TIME}ms"
    echo "  Resources ($RESOURCE_COUNT files): ${TOTAL_RESOURCE_TIME}ms"
    echo "  Total: ${TOTAL_TIME}ms"
    echo ""
}

analyze_full_page_load "claude.ai"
echo ""
analyze_full_page_load "slack.com"