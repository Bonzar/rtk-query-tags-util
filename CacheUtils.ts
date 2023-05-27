import { composeWith } from "ramda";
import type { AtLeastOneFunctionsFlow } from "ramda";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export type CacheID = string | number;

export type CacheItem<TagTypes extends string> =
  | TagTypes
  | { type: TagTypes; id: CacheID };

export type TagsError = FetchBaseQueryError | undefined;

/**
 * Callback to get tags, that can be passed to providesTags / invalidatesTags
 * fields in rtkQuery createApi object
 */
export type TagsProvider<R, A, TagTypes extends string> = (
  result: R,
  error: TagsError,
  arg: A
) => CacheItem<TagTypes>[];

/**
 * Tags array or callback to get tags, that can be passed to providesTags / invalidatesTags
 * fields in rtkQuery createApi object
 */
export type ProvidingTags<R, A, TagTypes extends string> =
  | TagsProvider<R, A, TagTypes>
  | CacheItem<TagTypes>[];

export type TagsAdder<TagTypes extends string> = <R, A>(
  tags?: ProvidingTags<R, A, TagTypes>
) => TagsProvider<R, A, TagTypes>;

export class CacheUtils<TagTypes extends string> {
  /**
   * Compose function that provides specified types Result and Args
   * for each of tagsAdder
   */
  public withTags<R, A>(
    tagsAdders: AtLeastOneFunctionsFlow<
      [tags?: ProvidingTags<R | undefined, A, TagTypes>],
      TagsProvider<R | undefined, A, TagTypes>
    >
  ) {
    return composeWith((fn, res) => fn(res))(tagsAdders);
  }

  public static getTags<R, A, TagTypes extends string>(
    result: R,
    error: TagsError,
    arg: A
  ): (
    tags?: ProvidingTags<R, A, TagTypes> | undefined
  ) => CacheItem<TagTypes>[] {
    return (tags) => {
      if (!tags) return [];

      if (typeof tags === "function") {
        return tags(result, error, arg);
      }

      return tags;
    };
  }

  private static concatTags<R, A, TagTypes extends string>(
    result: R,
    error: TagsError,
    arg: A
  ): (
    tagsLeft: ProvidingTags<R, A, TagTypes> | undefined
  ) => (
    tagsRight: ProvidingTags<R, A, TagTypes> | undefined
  ) => CacheItem<TagTypes>[] {
    return (tagsLeft) => (tagsRight) => {
      const tagsGetter = this.getTags<R, A, TagTypes>(result, error, arg);

      return [...tagsGetter(tagsLeft), ...tagsGetter(tagsRight)];
    };
  }

  /**
   * HOF creator that accept addition tags and return tags provider
   *
   * As result concat additional tags with tags passed to arg
   *
   * @example ```
   * const addProductTag = <R, A>() => createTagsGetter<R, A>(["Product"]);
   *
   * addProductTag(["Basket"])(result, error, args)
   * // [
   * //   "Product",
   * //   "Basket"
   * // ]
   * ```
   */
  public static createTagsAdder<R, A, TagTypes extends string>(
    providingTags: ProvidingTags<R | undefined, A, TagTypes>
  ): (
    tags?: ProvidingTags<R | undefined, A, TagTypes>
  ) => TagsProvider<R | undefined, A, TagTypes> {
    return (tags) => (result, error, arg) => {
      return this.concatTags<R | undefined, A, TagTypes>(
        result,
        error,
        arg
      )(providingTags)(tags);
    };
  }

  /**
   * @description HOF to create an entity cache to provide a LIST,
   * depending on the results.
   *
   * Will not provide individual items without a result.
   *
   * @example ```ts
   * const results = [
   *   { id: 1, message: 'foo' },
   *   { id: 2, message: 'bar' }
   * ]
   * withList('Product')()(results)
   * // [
   * //   { type: 'Product', id: 'LIST'},
   * //   { type: 'Product', id: 1 },
   * //   { type: 'Product', id: 2 },
   * // ]
   * ```
   */
  public withList<R extends Record<"id", CacheID>[], A>(type: TagTypes) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>((result) => {
      if (!result) {
        return [{ type, id: "LIST" }];
      }

      return [{ type, id: "LIST" }, ...result.map(({ id }) => ({ type, id }))];
    });
  }

  /**
   * HOF to create an entity cache to provide a LIST,
   * depending on the results.
   *
   * Extracted nested data from result
   *
   * Will not provide individual items without a result.
   *
   * @example ```ts
   * const results = { nestedResult: [
   *   { id: 1, message: 'foo' },
   *   { id: 2, message: 'bar' }
   * ]}
   * withNestedList('Product', result => result.nestedResult)()(results)
   * // [
   * //   { type: 'Product', id: 'LIST'},
   * //   { type: 'Product', id: 1 },
   * //   { type: 'Product', id: 2 },
   * // ]
   * ```
   */
  public withNestedList<R, A>(
    type: TagTypes,
    extractList: (result: R) => Record<"id", CacheID>[]
  ) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>((result) => {
      if (!result) {
        return [{ type, id: "LIST" }];
      }

      const list = extractList(result);

      return [{ type, id: "LIST" }, ...list.map(({ id }) => ({ type, id }))];
    });
  }

  /**
   * HOF to create an entity cache to provide a LIST,
   * depending on the results.
   *
   * 1. Extracted list data from result
   * 2. Extracted tag id from list item
   *
   * Will not provide individual items without a result.
   *
   * @example ```ts
   * const results = { nestedResult: [
   *   { productId: 1, message: 'foo' },
   *   { productId: 2, message: 'bar' }
   * ]}
   * withDeepNestedList('Product', result => result.nestedResult, item => item.productId)()(results)
   * // [
   * //   { type: 'Product', id: 'LIST'},
   * //   { type: 'Product', id: 1 },
   * //   { type: 'Product', id: 2 },
   * // ]
   * ```
   */
  public withDeepNestedList<R, A, IdItem extends Record<string, unknown>>(
    type: TagTypes,
    extractList: (result: NonNullable<R>) => IdItem[],
    extractId: (item: IdItem) => CacheID
  ) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>((result) => {
      if (!result) {
        return [{ type, id: "LIST" }];
      }

      const list = extractList(result);

      return [
        { type, id: "LIST" },
        ...list.map((item) => ({ type, id: extractId(item) })),
      ];
    });
  }

  /**
   * HOF to add tag with specified type and arg as id.
   *
   * @example ```ts
   * withArgAsId('Product')()({ id: 5, message: 'walk the fish' }, undefined, 5)
   * // [{ type: 'Product', id: 5 }]
   * ```
   */
  public withArgAsId<R, A extends CacheID>(type: TagTypes) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>((result, error, arg) => {
      return [{ type, id: arg }];
    });
  }

  /**
   * HOF to add tag with specified type and id extracted from arg.
   *
   * @example ```ts
   * withNestedArgId('Product', (arg) => arg.id)()(undefined, undefined, { id: 5 })
   * // [{ type: 'Product', id: 5 }]
   * ```
   */
  public withNestedArgId<R, A>(type: TagTypes, extractId: (arg: A) => CacheID) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>((result, error, arg) => {
      const id = extractId(arg);

      return [{ type, id }];
    });
  }

  /**
   * HOF to add tag with specified type and id extracted from result.
   *
   * @example ```ts
   * withNestedArgId('Product', (res) => res.id)()({ id: 5 }, undefined, undefined)
   * // [{ type: 'Product', id: 5 }]
   * ```
   */
  public withNestedResultId<R, A>(
    type: TagTypes,
    extractId: (result: R) => CacheID
  ) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>((result) => {
      if (!result) {
        return [];
      }

      const id = extractId(result);

      return [{ type, id }];
    });
  }

  /**
   * HOF to add tag with id LIST
   *
   * @example ```ts
   * invalidatesList('Product')()
   * // [{ type: 'Product', id: 'LIST' }]
   * ```
   */
  public invalidateList<R, A>(type: TagTypes) {
    return CacheUtils.createTagsAdder<R, A, TagTypes>([{ type, id: "LIST" }]);
  }

  /**
   * HOF to invalidate specified tags on success request
   * @example ```ts
   * invalidateOnSuccess(['Product'])({ some: "data" }, undefined, undefined )
   * // ['Product']
   *
   * invalidateOnSuccess(() => ['Product'])(undefined, {status: 401, error: ""}, undefined )
   * // []
   * ```
   */
  public invalidateOnSuccess<R, A>(
    successTags?: ProvidingTags<R, A, TagTypes>
  ) {
    return (result: R, error: TagsError, arg: A) => {
      if (error) return [];

      return CacheUtils.getTags<R, A, TagTypes>(
        result,
        error,
        arg
      )(successTags);
    };
  }
}
