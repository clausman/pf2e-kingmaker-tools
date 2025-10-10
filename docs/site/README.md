# Kingdom Actions Quick Reference

A mobile-friendly, interactive reference page for Kingdom Actions in Pathfinder 2e Kingmaker.

## Overview

This website provides an easy-to-use interface for quickly looking up Kingdom Actions that players can choose during kingdom building. It displays all actions organized by phase (Commerce, Leadership, Region, Civic, Army, and Upkeep) with full details including descriptions, requirements, and outcomes.

## Features

- **Search**: Real-time search through action names and descriptions
- **Phase Filtering**: Filter actions by kingdom phase (Commerce, Leadership, Region, Civic, Army, Upkeep)
- **Expandable Details**: Click on any action to see full details including:
  - Description
  - Requirements
  - Skills needed
  - DC type
  - Critical Success, Success, Failure, and Critical Failure outcomes
  - Special notes and automation notes
- **Mobile-Friendly**: Responsive design optimized for phones and tablets
- **Clean Interface**: Minimal design focused on readability and quick reference

## Usage

### Running Locally

1. Build the project to generate the JSON data files:
   ```bash
   ./gradlew combineJsonFiles
   ```

2. Copy the data files to the site directory:
   ```bash
   cd docs/site
   mkdir -p data
   cp ../../build/generated/data/kingdom-activities.json data/
   cp ../../lang/en.json data/
   ```

3. Start a local web server:
   ```bash
   python3 -m http.server 8080
   ```

4. Open your browser to `http://localhost:8080`

### Deploying

The site consists of static HTML, CSS, and JavaScript files that can be hosted on any web server. Make sure the data files are in the `data/` subdirectory relative to the HTML file.

## Data Sources

The website loads data directly from:
- `data/kingdom-activities.json` - Combined activities from all individual JSON files in `data/kingdom-activities/`
- `data/en.json` - English translations for all text strings

This ensures the website always displays the most current game data without needing to manually update content.

## Browser Compatibility

The site works in all modern browsers including:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Technology Stack

- **HTML5** - Semantic markup
- **Tailwind CSS** - Utility-first CSS framework
- **Vanilla JavaScript** - No framework dependencies
- **JSON** - Data loading from existing game files

## License

This tool is part of the pf2e-kingmaker-tools project. See the main project README for license information.
