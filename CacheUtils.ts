import { compose } from "ramda";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export type TagID = string | number;

export type TagItem<TagTypes extends string> =
  | TagTypes
  | { type: TagTypes; id: TagID };

/**
 * Callback to get tags, that can be passed to providesTags / invalidatesTags
 * fields in rtkQuery createApi object
 */
export type TagsCallback<R, A, TagTypes extends string, TagsQueryError> = (
  result: R | undefined,
  error: TagsQueryError | undefined,
  arg: A
) => TagItem<TagTypes>[];

/**
 * Tags array or callback to get tags, that can be passed to providesTags / invalidatesTags
 * fields in rtkQuery createApi object
 */
export type ProvidingTags<R, A, TagTypes extends string, TagsQueryError> =
  | TagsCallback<R, A, TagTypes, TagsQueryError>
  | TagItem<TagTypes>[];

export type TagsProvider<R, A, TagTypes extends string, TagsQueryError> = (
  tags?: ProvidingTags<R, A, TagTypes, TagsQueryError>
) => TagsCallback<R, A, TagTypes, TagsQueryError>;

export type TagsWrapper<
  TagTypes extends string,
  TagsQueryError = FetchBaseQueryError
> = <R, A>(
  tags?: ProvidingTags<R, A, TagTypes, TagsQueryError>
) => TagsCallback<R, A, TagTypes, TagsQueryError>;

export class CacheUtils<
  TagTypes extends string,
  TagsQueryError = FetchBaseQueryError
> {
  /**
   * This function is used to compose multiple tags provider functions together and pass typings from the generic to each of them.
   *
   * It provides a better way to type multiple tags providers.
   *
   * @example ```ts
   * withTags<ResultType, ArgType>([
   *   // no needed to pass typings for each of tags provider
   *   withList("BasketProduct"),
   *   withArgAsId("Basket"),
   * ])(),
   * ```
   */
  public withTags = <R, A>(
    tagsProviders: TagsProvider<R, A, TagTypes, TagsQueryError>[]
  ): TagsProvider<R, A, TagTypes, TagsQueryError> =>
    compose(...(tagsProviders as [any]));

  public getTags =
    <R, A>(result: R | undefined, error: TagsQueryError | undefined, arg: A) =>
    (tags: ProvidingTags<R, A, TagTypes, TagsQueryError> | undefined) => {
      if (!tags) return [] as TagItem<TagTypes>[];

      if (typeof tags === "function") {
        return tags(result, error, arg);
      }

      return tags;
    };

  public concatTags =
    <R, A>(result: R | undefined, error: TagsQueryError | undefined, arg: A) =>
    (tagsLeft: ProvidingTags<R, A, TagTypes, TagsQueryError> | undefined) =>
    (tagsRight: ProvidingTags<R, A, TagTypes, TagsQueryError> | undefined) => {
      const tagsGetter = this.getTags(result, error, arg);

      return [...tagsGetter(tagsLeft), ...tagsGetter(tagsRight)];
    };

  /**
   * TagsProvider creator that accepts addition tags and return tags provider
   *
   * As a result, concat additional tags with tags passed to arg
   *
   * @example ```
   * const addProductIdTag = <R, A>(id: string | number) =>
   *     createTagsGetter<R, A, TagTypes>([{ type: "Product", id }]);
   *
   * addProductTag(10)(["Basket"])(result, error, args)
   * // [
   * //   { type: "Product", id: 10 },
   * //   "Basket"
   * // ]
   * ```
   */
  public createTagsProvider =
    <R, A>(
      providingTags: ProvidingTags<R, A, TagTypes, TagsQueryError>
    ): TagsProvider<R, A, TagTypes, TagsQueryError> =>
    (tags) =>
    (result, error, arg) => {
      return this.concatTags(result, error, arg)(providingTags)(tags);
    };

  /**
   * Adds tags with the specified type and ids: "LIST", id property of items from the result array.
   *
   * If the result is rejected, only a tag with the id "LIST" will be provided.
   *
   * @example ```ts
   * const results = [
   *   { id: 1, message: "foo" },
   *   { id: 2, message: "bar" },
   * ];
   *
   * withList('Product')()(results, undefined, undefined)
   * // [
   * //   { type: "Product", id: "LIST"},
   * //   { type: "Product", id: 1 },
   * //   { type: "Product", id: 2 },
   * // ]
   * ```
   */
  public withList = <R extends Record<"id", TagID>[], A>(type: TagTypes) =>
    this.createTagsProvider<R, A>((result) => {
      if (!result) {
        return [{ type, id: "LIST" }];
      }

      return [{ type, id: "LIST" }, ...result.map(({ id }) => ({ type, id }))];
    });

  /**
   * Adds tags with the specified type and ids: `"LIST"`, `id` property of items from the extracted list.
   *
   * The list is extracted from the result using the `extractList` function.
   *
   * If the result is rejected, only a tag with the id `"LIST"` will be provided.
   *
   * @example ```ts
   * const results = {
   *   nested: {
   *     list: [
   *       { id: 1, message: "foo" },
   *       { id: 2, message: "bar" },
   *     ],
   *   },
   * };
   *
   * withNestedList("Product", result => result.nestedResult)()(results, undefined, undefined)
   * // [
   * //   { type: "Product", id: "LIST"},
   * //   { type: "Product", id: 1 },
   * //   { type: "Product", id: 2 },
   * // ]
   * ```
   */
  public withNestedList = <R, A>(
    type: TagTypes,
    extractList: (result: R) => Record<"id", TagID>[]
  ) =>
    this.createTagsProvider<R, A>((result) => {
      if (!result) {
        return [{ type, id: "LIST" }];
      }

      const list = extractList(result);

      return [{ type, id: "LIST" }, ...list.map(({ id }) => ({ type, id }))];
    });

  /**
   * Adds tags with the specified type and ids: `"LIST"`, ids as properties extracted from items in the extracted list.
   *
   * The list is extracted from the result using the `extractList` function.
   *
   * The id is extracted from each item in the list using the `extractId` function.
   *
   * If the result is rejected, only a tag with the id `"LIST"` will be provided.
   *
   * @example ```ts
   * const results = {
   *   nestedResult: [
   *     { productId: 1 },
   *     { productId: 2 },
   *   ];
   * };
   *
   * withDeepNestedList(
   *  "Product",
   *  result => result.nestedResult,
   *  item => item.productId
   * )()(results, undefined, undefined)
   * // [
   * //   { type: "Product", id: "LIST"},
   * //   { type: "Product", id: 1 },
   * //   { type: "Product", id: 2 },
   * // ]
   * ```
   */
  public withDeepNestedList = <R, A, IdItem extends Record<string, unknown>>(
    type: TagTypes,
    extractList: (result: NonNullable<R>) => IdItem[],
    extractId: (item: IdItem) => TagID
  ) =>
    this.createTagsProvider<R, A>((result) => {
      if (!result) {
        return [{ type, id: "LIST" }];
      }

      const list = extractList(result);

      return [
        { type, id: "LIST" },
        ...list.map((item) => ({ type, id: extractId(item) })),
      ];
    });

  /**
   * Adds a tag with the specified type and the argument as the id.
   *
   * @example ```ts
   * withArgAsId("Product")()({}, undefined, 5)
   * // [{ type: "Product", id: 5 }]
   * ```
   */
  public withArgAsId = <R, A extends TagID>(type: TagTypes) =>
    this.createTagsProvider<R, A>((result, error, arg) => {
      return [{ type, id: arg }];
    });

  /**
   * Adds a tag with the specified type and the id, as an extracted field from the argument
   *
   * @example ```ts
   * withNestedArgId("Product", (arg) => arg.id)()({}, undefined, { id: 5 })
   * // [{ type: "Product", id: 5 }]
   * ```
   */
  public withNestedArgId = <R, A>(
    type: TagTypes,
    extractId: (arg: A) => TagID
  ) =>
    this.createTagsProvider<R, A>((result, error, arg) => {
      const id = extractId(arg);

      return [{ type, id }];
    });

  /**
   * Adds a tag with the specified type and the id, as an extracted field from the result
   *
   * @example ```ts
   * withNestedArgId("Product", (res) => res.id)()({ id: 5 }, undefined, undefined)
   * // [{ type: "Product", id: 5 }]
   * ```
   */
  public withNestedResultId = <R, A>(
    type: TagTypes,
    extractId: (result: R) => TagID
  ) =>
    this.createTagsProvider<R, A>((result) => {
      if (!result) {
        return [];
      }

      const id = extractId(result);

      return [{ type, id }];
    });

  /**
   * Adds a tag with the specified type and id `"LIST"`.
   *
   * @example ```ts
   * invalidatesList('Product')()
   * // [{ type: "Product", id: "LIST" }]
   * ```
   */
  public invalidateList = <R, A>(type: TagTypes) =>
    this.createTagsProvider<R, A>([{ type, id: "LIST" }]);

  /**
   * Adds the tags passed to the `successTags` argument, if the request is successful.
   *
   * Otherwise, nothing will be provided.
   *
   * @example ```ts
   * invalidateOnSuccess(["Product"])({ some: "data" }, undefined, undefined )
   * // ['Product']
   *
   * invalidateOnSuccess(() => ["Product"])(undefined, {status: 401, error: ""}, undefined )
   * // []
   * ```
   */
  public invalidateOnSuccess: TagsWrapper<TagTypes, TagsQueryError> =
    (successTags) => (result, error, arg) => {
      if (error) return [];

      return this.getTags(result, error, arg)(successTags);
    };
}
