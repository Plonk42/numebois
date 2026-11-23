import type { AnimalName } from '../scene/animal-catalog';
import { canBuy, type Article, type ShopItem } from '../scene/shop';
import { LeafIcon, plural, SeedIcon } from './reserve';
import { SEASON_LABELS, SeasonIcon } from './seasons';

export const ANIMAL_LABELS: Record<AnimalName, string> = {
  Deer: 'Une biche',
  Stag: 'Un cerf',
  Fox: 'Un renard',
  Wolf: 'Un loup',
  Donkey: 'Un âne',
  Alpaca: 'Un alpaga',
  Horse: 'Un cheval',
  Cow: 'Une vache',
};

const labelOf = (article: Article) => {
  if (article.kind === 'element') return 'Une pousse';
  return article.kind === 'animal' ? ANIMAL_LABELS[article.animal] : SEASON_LABELS[article.season];
};

const keyOf = (article: Article) => {
  if (article.kind === 'element') return 'element';
  return article.kind === 'animal' ? article.animal : article.season;
};

/** A young shoot: it becomes a tree or a grove, depending on the place chosen. */
function SproutIcon() {
  return (
    <svg class="sprout" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse class="soil" cx="32" cy="54" rx="20" ry="6" />
      <path class="stem" d="M32 54C32 44 31 36 33 26" />
      <path class="leaf" d="M32 36C22 38 13 32 10 20c12-2 21 4 22 16z" />
      <path class="leaf" d="M33 28c2-12 11-19 23-18-1 12-10 19-23 18z" />
    </svg>
  );
}

/** What is still to earn, never what is missing. */
function toGo(item: ShopItem, leaves: number, seeds: number): string | null {
  if (item.elementsToGo > 0) return `Encore ${plural(item.elementsToGo, 'pousse', 'pousses')}`;
  if (leaves < item.leaves) return `Encore ${plural(item.leaves - leaves, 'feuille', 'feuilles')}`;
  if (seeds < item.seeds) {
    return `Encore ${plural(item.seeds - seeds, 'graine dorée', 'graines dorées')}`;
  }
  return null;
}

interface Props {
  items: readonly ShopItem[];
  leaves: number;
  seeds: number;
  portrait(animal: AnimalName): string | null;
  onBuy(item: ShopItem): void;
}

/**
 * The shop of the forest, at the end of the trail: a few articles with big pictures, one
 * touch to buy. An article out of reach shows what is still to earn.
 */
export function Shop({ items, leaves, seeds, portrait, onBuy }: Props) {
  return (
    <ul class="shop" aria-label="Boutique de la forêt">
      {items.map((item) => {
        const { article } = item;
        const label = labelOf(article);
        const ready = canBuy(item, leaves, seeds);
        const missing = toGo(item, leaves, seeds);
        const price = item.seeds > 0 ? item.seeds : item.leaves;
        const priceLabel =
          item.seeds > 0
            ? plural(item.seeds, 'graine dorée', 'graines dorées')
            : plural(item.leaves, 'feuille', 'feuilles');
        let state = 'ready';
        if (item.elementsToGo > 0) state = 'later';
        else if (!ready) state = 'saving';
        const image = article.kind === 'animal' ? portrait(article.animal) : null;
        return (
          <li key={keyOf(article)}>
            <button
              type="button"
              class={`article ${state}`}
              disabled={!ready}
              aria-label={`${label}, ${priceLabel}`}
              onPointerDown={() => onBuy(item)}
            >
              <span class="picture">
                {article.kind === 'element' && <SproutIcon />}
                {article.kind === 'season' && <SeasonIcon season={article.season} />}
                {image && <img src={image} alt="" draggable={false} />}
              </span>
              <span class="name">{label}</span>
              <span class="price">
                {item.seeds > 0 ? <SeedIcon /> : <LeafIcon />}
                {price}
              </span>
              {missing && <span class="to-go">{missing}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
