/**
 * Fiches de référence pour les grands récits en prose de Victor Hugo présents dans le corpus.
 * Dates et résumés : synthèse à partir des articles Wikipédia en français (CC BY-SA 4.0).
 * Voir les liens `wikipediaUrl` pour le détail et les sources bibliographiques des articles.
 */

export type HugoProseKind = "roman" | "récit" | "nouvelle"

export interface HugoWorkReference {
  /** Aligné sur slug_oeuvre RAGFlow (clé du fichier sans .txt avant tout --chapitre). */
  slugOeuvre: string
  titre: string
  kind: HugoProseKind
  /** Période de rédaction ou de remaniement majeur, telle que décrite sur Wikipédia. */
  periodeEcriture: string
  /** Année de la première édition en volume ou du feuilleton inaugural (repère bibliographique). */
  premierePublication: number
  resume: string
  /** Illustration ou document lié à l’œuvre sur Wikimedia Commons (pas toujours une couverture d’édition). */
  coverImageUrl?: string
  wikipediaUrl: string
}

const HUGO_WORK_REFERENCES: Record<string, HugoWorkReference> = {
  "han-dislande": {
    slugOeuvre: "han-dislande",
    titre: "Han d’Islande",
    kind: "roman",
    periodeEcriture:
      "Première version rédigée en janvier 1820 ; éditions remaniées jusqu’en 1833 (édition définitive Renduel, mai 1833).",
    premierePublication: 1823,
    resume:
      "Roman de jeunesse dont une première forme paraît sans nom d’auteur dans Le Conservateur littéraire en 1820, puis est largement remaniée ; l’édition du 8 février 1823 marque une étape décisive avant d’autres versions. L’intrigue mêle aventures et passions dans un cadre nordique et romanesque.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Georges-Antoine_Rochegrosse_-_Han_d%27Islande.jpg/330px-Georges-Antoine_Rochegrosse_-_Han_d%27Islande.jpg",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/Han_d'Islande",
  },
  "bug-jargal": {
    slugOeuvre: "bug-jargal",
    titre: "Bug-Jargal",
    kind: "roman",
    periodeEcriture:
      "Conte rédigé en quinze jours vers 1819-1820 (pari de l’adolescent) ; parution du conte en 1820 ; roman remanié publié en 1826.",
    premierePublication: 1826,
    resume:
      "Considéré comme le premier roman de Hugo : le conte paraît dans Le Conservateur littéraire en 1820, puis le texte est développé en roman, édité pour la première fois en 1826. L’action est liée à la révolution haïtienne et au personnage de Bug-Jargal.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Bug-Jargal_Urbain_Canel_1826.png/330px-Bug-Jargal_Urbain_Canel_1826.png",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/Bug-Jargal",
  },
  "le-dernier-jour-dun-condamne": {
    slugOeuvre: "le-dernier-jour-dun-condamne",
    titre: "Le Dernier Jour d’un condamné",
    kind: "roman",
    periodeEcriture:
      "Rédigé après l’exécution du 10 septembre 1827 ; première édition anonyme en février 1829 ; longue préface signée en 1832.",
    premierePublication: 1829,
    resume:
      "Roman à thèse et plaidoyer contre la peine de mort, présenté comme le journal intime d’un condamné dans les dernières heures avant son exécution. Publié chez Charles Gosselin ; l’auteur ne signe de son nom que plus tard, avec une préface ajoutée en 1832.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/HugoLastDayCondemnedMan.jpg/330px-HugoLastDayCondemnedMan.jpg",
    wikipediaUrl:
      "https://fr.wikipedia.org/wiki/Le_Dernier_Jour_d'un_condamn%C3%A9",
  },
  "notre-dame-de-paris": {
    slugOeuvre: "notre-dame-de-paris",
    titre: "Notre-Dame de Paris",
    kind: "roman",
    periodeEcriture: "Manuscrit de septembre 1830 à janvier 1831.",
    premierePublication: 1831,
    resume:
      "Roman historique dont le titre complet est « Notre-Dame de Paris. 1482 » ; la cathédrale en est le cœur symbolique et le lieu central de l’intrigue, à Paris à la fin du XVe siècle. Une première édition en mars 1831 diffère de l’édition définitive (Renduel, 1832) qui réintègre des chapitres retirés au départ.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Notre_Dame_de_Paris_Victor_Hugo_Manuscrit_1.jpg/330px-Notre_Dame_de_Paris_Victor_Hugo_Manuscrit_1.jpg",
    wikipediaUrl:
      "https://fr.wikipedia.org/wiki/Notre-Dame_de_Paris_(roman)",
  },
  "claude-gueux": {
    slugOeuvre: "claude-gueux",
    titre: "Claude Gueux",
    kind: "récit",
    periodeEcriture:
      "Projet nourri par le procès rapporté en mars 1832 ; texte publié en feuilleton le 6 juillet 1834.",
    premierePublication: 1834,
    resume:
      "Récit inspiré par un fait divers et le compte rendu du procès de Claude Gueux : la vie du condamné de l’entrée en prison à l’exécution, avec une réflexion sur la misère, la disproportion des peines et la responsabilité sociale. Hugo y prolonge son combat contre la peine de mort mené dans Le Dernier Jour d’un condamné.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Rioult%2C_Louis-Edouard_-_Claude_Gueux_rapportant_%C3%A0_sa_famille_le_pain_vol%C3%A9_-_224_-_Maison_de_Victor_Hugo.jpg/330px-Rioult%2C_Louis-Edouard_-_Claude_Gueux_rapportant_%C3%A0_sa_famille_le_pain_vol%C3%A9_-_224_-_Maison_de_Victor_Hugo.jpg",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/Claude_Gueux",
  },
  "les-miserables": {
    slugOeuvre: "les-miserables",
    titre: "Les Misérables",
    kind: "roman",
    periodeEcriture:
      "Ébauche dès 1845 ; interruption en février 1848 ; reprise à Guernesey en 1860 (mention manuscrite 14 février / 30 décembre 1860) ; achèvement et publication à partir de fin mars 1862.",
    premierePublication: 1862,
    resume:
      "Vaste roman historique, social et philosophique sur la France du premier tiers du XIXe siècle, centré sur le parcours de Jean Valjean et des figures qui croisent sa route, entre misère, justice, rédemption et révolte (notamment les barricades de 1832). La préface pose la question de la dégradation du prolétariat, de la femme et de l’enfant par la misère.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Cosette-sweeping-les-miserables-emile-bayard-1862.jpg/330px-Cosette-sweeping-les-miserables-emile-bayard-1862.jpg",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/Les_Mis%C3%A9rables",
  },
  "les-travailleurs-de-la-mer": {
    slugOeuvre: "les-travailleurs-de-la-mer",
    titre: "Les Travailleurs de la mer",
    kind: "roman",
    periodeEcriture:
      "Rédigé à Hauteville House (Guernesey) pendant l’exil ; préface datée de mars 1866 ; publication en feuilleton dès le 17 avril 1866.",
    premierePublication: 1866,
    resume:
      "Roman dédié à Guernesey : le marin solitaire Gilliatt accepte de récupérer la machine du vapeur échoué sur le récif des Douvres pour épouser Déruchette, promise par son oncle armateur ; après l’épreuve des éléments et de la pieuvre, le dénouement est celui du sacrifice et de l’effacement. Hugo y traite la « troisième fatalité », celle de la nature, après la religion (Notre-Dame) et la société (Les Misérables).",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Victor_Hugo-Octopus.jpg/330px-Victor_Hugo-Octopus.jpg",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/Les_Travailleurs_de_la_mer",
  },
  "lhomme-qui-rit": {
    slugOeuvre: "lhomme-qui-rit",
    titre: "L’Homme qui rit",
    kind: "roman",
    periodeEcriture:
      "Projet de trilogie dès 1861-1862 ; rédaction du 21 juillet 1866 au 23 août 1868 (une grande partie à Guernesey, début et fin à Bruxelles).",
    premierePublication: 1869,
    resume:
      "Roman philosophique et dramatique situé dans l’Angleterre de la fin du XVIIe et du début du XVIIIe siècle ; le héros Gwynplaine, au visage mutilé en un rictus permanent, incarne une dénonciation de l’aristocratie — le livre devait former avec d’autres volumes une vaste fresque politique menant à Quatrevingt-treize.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/L%27Homme_qui_rit_-_illustration_de_Daniel_Vierge%2C_bois_grav%C3%A9_par_%C3%89douard_Berveiller.jpg/330px-L%27Homme_qui_rit_-_illustration_de_Daniel_Vierge%2C_bois_grav%C3%A9_par_%C3%89douard_Berveiller.jpg",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/L'Homme_qui_rit",
  },
  "quatre-vingt-treize": {
    slugOeuvre: "quatre-vingt-treize",
    titre: "Quatrevingt-treize",
    kind: "roman",
    periodeEcriture:
      "Écriture du 16 décembre 1872 au 9 juin 1873 à Guernesey, dans la foulée d’un projet mûri depuis les années 1860 ; parution en 1874.",
    premierePublication: 1874,
    resume:
      "Dernier roman de Hugo, d’une graphie voulue par l’auteur sans trait d’union : l’action se situe en 1793, sous la Terreur révolutionnaire. L’ouvrage devait compléter une trilogie sur la Révolution (après L’Homme qui rit), mais le volume sur la monarchie n’a pas été rédigé ; le roman prolonge la réflexion de Hugo sur la Révolution et fait écho, pour les contemporains, à la Commune.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/QuatreVingtTreize_Victor_Hugo.jpg/330px-QuatreVingtTreize_Victor_Hugo.jpg",
    wikipediaUrl: "https://fr.wikipedia.org/wiki/Quatrevingt-treize",
  },
}

export function getVictorHugoWorkReference(
  slugOeuvre: string
): HugoWorkReference | undefined {
  return HUGO_WORK_REFERENCES[slugOeuvre]
}

export function listVictorHugoWorkReferenceSlugs(): string[] {
  return Object.keys(HUGO_WORK_REFERENCES)
}
