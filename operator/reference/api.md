# FarmFactory API

Base URL from `farmfactory.baseUrl` in `~/.operator/config.json` (or `FARMFACTORY_URL`);
the hosted instance is `https://factory.farmwork.dev`.
Every request needs the `X-API-Key` header; keys are created in FarmFactory under
Admin → API Keys. A bad or missing key returns `401 {"error":"Unauthorized"}`.

Prefer the `operator` CLI over calling these directly — it resolves farm names to ids
and formats the output. These are here for when you need the raw shape.

## Farms

### `GET /api/farms`

```json
[
  {
    "id": 3,
    "name": "Farmwork",
    "slug": "farmwork",
    "full_name": "WynterJones/farmwork",
    "github_org": "WynterJones",
    "github_repo": "farmwork",
    "group_name": "Tools",
    "url": "https://github.com/WynterJones/farmwork",
    "score": 8.4,
    "checklist_id": 7,
    "checklist_percentage": 62,
    "checklist_completed": 13,
    "checklist_total": 21,
    "last_synced_at": "2026-07-29T18:02:11Z"
  }
]
```

`score` is the average score across that farm's synced Farmwork documents (0 if none).

## Checklists

### `GET /api/checklists`

Every checklist with progress. `effective_total` is the item count minus skipped
items, so `percentage` is measured against what's actually in scope.

```json
[
  {
    "id": 7,
    "name": "Farmwork",
    "repository_id": 3,
    "repository_slug": "farmwork",
    "percentage": 62,
    "completed_count": 13,
    "skipped_count": 2,
    "total_count": 23,
    "effective_total": 21,
    "created_at": "2026-07-01T10:00:00Z",
    "updated_at": "2026-07-29T18:02:11Z"
  }
]
```

### `GET /api/checklists/:id`

The same object plus every item. Items are ordered by group, then position. A child
item carries its parent's id in `parent_id`. `status` is one of `completed`,
`skipped`, `pending`.

```json
{
  "id": 7,
  "percentage": 62,
  "items": [
    {
      "id": 12,
      "title": "Set up CI",
      "description": "Green build on every push",
      "group_name": "Infra",
      "parent_id": null,
      "link": "https://…",
      "position": 0,
      "status": "completed"
    }
  ]
}
```

### `POST /api/checklists`

Body: `{"repository": "farmwork"}` — accepts a repository id, slug, or `org/repo`
full name. Optional `name` for a checklist not tied to a repository.

`201` with the checklist. `404` if no farm matches. `422` if that farm already has a
checklist (a repository can only have one).

### `DELETE /api/checklists/:id`

`{"id": 7, "deleted": true}`. Cascades to that checklist's completions.

## Items

All three item routes are **idempotent** — calling `complete` twice leaves the item
completed rather than toggling it back off. Safe to retry.

| Route | Effect |
|---|---|
| `POST /api/checklists/:id/items/:item_id/complete` | mark done |
| `POST /api/checklists/:id/items/:item_id/skip` | mark out of scope, drops it from `effective_total` |
| `DELETE /api/checklists/:id/items/:item_id` | back to pending |

Each returns the item's new state and the checklist's recalculated progress:

```json
{
  "checklist_id": 7,
  "item_id": 12,
  "status": "completed",
  "percentage": 67,
  "completed_count": 14,
  "effective_total": 21
}
```

### `POST /api/checklists/:id/complete`

Bulk. Body: `{"item_ids": [12, 15, 18]}`. Unknown ids are reported back rather than
failing the batch:

```json
{
  "percentage": 81,
  "completed_item_ids": [12, 15, 18],
  "unknown_item_ids": []
}
```

`422` if `item_ids` is missing or empty.

### `GET /api/checklist_items`

The global item catalog every checklist is measured against — id, title, description,
`group_name`, `parent_id`, `link`, `position`. Items are managed in FarmFactory's
admin area; the API is read-only.

## Errors

| Status | Meaning |
|---|---|
| 401 | Missing or unknown API key |
| 404 | No such checklist, item, or farm |
| 422 | Invalid body — `messages` carries the validation errors |
