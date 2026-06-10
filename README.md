# Hérouval Control

Système de gestion des groupes scolaires pour parc à thème.

## Architecture

- **Frontend**: HTML, CSS, JavaScript vanilla
- **Base de données**: Firebase Firestore (temps réel)
- **OCR**: Tesseract.js (reconnaissance des plaques)
- **QR Codes**: QRCode.js
- **Hébergement**: GitHub Pages
- **PWA**: Progressive Web App avec offline support

## Pages

### 1. index.html
Page d'accueil avec navigation vers les différents modules.

### 2. agent.html (Agent de Contrôle)
Enregistrement des bus à l'arrivée :
- Scan automatique des plaques d'immatriculation (OCR)
- Saisie manuelle en backup
- Formulaire : école, ville, code postal, nombre d'enfants/accompagnateurs
- Signature du responsable
- Génération automatique du groupe ID (format: #2024-0001)
- Création du QR code unique
- Synchronisation temps réel avec la caisse

### 3. caisse.html (Caisse)
Gestion des paiements et activités :
- Liste des groupes triés par ordre d'arrivée
- Sélection d'un groupe pour affichage des détails
- Ajout des activités payantes avec quantité
- Option "Groupe complet" pour chaque activité
- Génération PDF avec QR code pour impression
- Mise à jour du statut en "payé"

### 4. operateurs.html (Opérateurs)
Scan des groupes aux attractions :
- Sélection de l'attraction
- Scanner QR code automatique
- Vérification des droits d'accès
- Affichage des places autorisées/utilisées/restantes
- Liste des activités disponibles pour le groupe
- Validation de l'entrée
- Marquage des activités déjà effectuées

### 5. bureaux.html (Bureaux)
Tableau de bord en lecture seule :
- Statistiques temps réel (groupes, visiteurs, enfants)
- Liste complète avec filtres (statut, recherche)
- Détails complets des groupes
- QR codes miniatures
- Modal de détails

## Fonctionnalités Clés

### Génération des IDs de groupe
Format: `#(année)-0000`
- Les numéros commencent à 1 chaque semaine
- Maximum 9999 groupes par semaine
- Exemple: #2024-0001, #2024-0002...

### Synchronisation Temps Réel
Tous les modules utilisent Firebase Firestore pour la synchronisation instantanée :
- Un groupe enregistré par l'agent apparaît immédiatement à la caisse
- Les paiements sont reflétés sur tous les postes
- Les scans des opérateurs mettent à jour les compteurs en temps réel

### QR Codes
Chaque groupe a un QR code unique qui contient son ID. Il sert de :
- Carte d'identité du groupe
- Ticket d'accès aux attractions
- Justificatif pour les contrôles

## Installation

### Prérequis
- Un compte Firebase
- Accès à GitHub Pages ou autre hébergeur statique

### Configuration Firebase
1. Créer un projet Firebase
2. Activer Firestore Database
3. Récupérer la configuration (déjà incluse dans `app.js`)
4. Configurer les règles de sécurité Firestore

### Déploiement GitHub Pages
1. Forker/cloner ce repository
2. Aller dans Settings > Pages
3. Sélectionner la branche main comme source
4. Le site sera accessible à `https://[username].github.io/herouval-control/`

### Installation PWA (Smartphones)
1. Ouvrir le site sur Chrome/Safari
2. Cliquer sur "Ajouter à l'écran d'accueil"
3. L'application fonctionne hors ligne pour les pages statiques

## Règles Firestore Recommandées

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if false;
    }
  }
}
```

## Dépendances (CDN)

- Firebase SDK 10.7.0
- Tesseract.js 4.1.1 (OCR)
- QRCode.js 1.0.0
- jsPDF 2.5.1
- html5-qrcode 2.3.8 (scanner QR)

## Design

- Interface minimalist et professionnelle
- Palette sombre (bleu nuit)
- Optimisé pour mobile (smartphones des agents)
- Responsive design
- Animations subtiles

## Compatibilité

- Chrome/Edge (recommandé)
- Safari iOS
- Firefox
- Nécessite une connexion internet (synchronisation Firestore)

## Notes

- La caméra nécessite HTTPS (sauf localhost)
- L'OCR des plaques fonctionne mieux avec une bonne luminosité
- Le mode hors ligne permet de consulter les pages mais pas de synchroniser
- Les QR codes sont générés côté client

## Licence

Propriétaire - Usage interne Hérouval uniquement
