# @bonzar/rtk-query-tags-util

Utility package that provides convenient functions for working with tags in Redux Toolkit Query. It offers various helper functions to simplify the management of tags.

The utils are implemented as higher-order functions.

## Installation

You can install package with:

```shell
npm install @bonzar/rtk-query-tags-util
```

or

```shell
yarn add @bonzar/rtk-query-tags-util
```

## Configuration

To ensure correct types, you need to pass the `TagTypes` from `apiSlice`. It's recommended to create a separate file, such as `apiCacheUtils.ts`, for this purpose.

Create an instance of the `CacheUtils` class with the `TagTypes` passed as a generic.

From here, you can export the necessary utils for convenient importing in other files.

```typescript
// apiCacheUtils.ts

import type { TagTypes } from "../apiSlice";
import { CacheUtils } from "@bonzar/rtk-query-tags-util";

const cacheUtils = new CacheUtils<TagTypes>();

export const {
  withList,
  withArgAsId,
  withNestedList,
  withNestedArgId,
  withNestedResultId,
  withDeepNestedList,
  invalidateList,
  invalidateOnSuccess,
  withTags,
} = cacheUtils;
```

```typescript
// apiSlice.ts

import { createApi } from "@reduxjs/toolkit/query/react";

const tagTypes = ["Product", "Basket"] as const; // don't forget const

export type TagTypes = (typeof tagTypes)[number];

export const apiSlice = createApi({
  // ... other api options
  tagTypes,
});
```

### Create Your Own Tag Utility

This is also a good place to create additional utils. You can do this easily with the `createTagsProvider()` and `getTags()` functions.

#### Creating Tags Provider

To provide additional tags based on the result, error, and argument:

```typescript
export function withResultAsId<R extends string | number, A>(type: TagTypes) {
  return CacheUtils.createTagsProvider<R, A, TagTypes>((result, error, arg) => {
    if (!result) {
      return [];
    }

    return [{ type, id: result }]; // tags that will be added to tags list
  });
}
```

#### Creating Tags Wrapper

This can be useful to conditionally include providing tags. The `invalidateOnSuccess()` utility is already implemented for this purpose:

```typescript
import type {
  ProvidingTags,
  TagsCallbackError,
} from "@bonzar/rtk-query-tags-util";

export function invalidateOnError<R, A>(
  errorTags?: ProvidingTags<R, A, TagTypes>
) {
  return (result: R | undefined, error: TagsCallbackError, arg: A) => {
    if (!error) return [];

    return CacheUtils.getTags<R, A, TagTypes>(result, error, arg)(errorTags);
  };
}
```

## Usage

To provide tags, put the utility function in the `providesTags`/`invalidatesTags` field of the createApi object.

All utilities can be used as `providesTags` or `invalidatesTags`.

```typescript
import { createApi } from "@reduxjs/toolkit/query/react";
import { withArgAsId } from "./apiCacheUtils";

const apiSlice = createApi({
  // ... other api creation options
  endpoints: (build) => ({
    getProducts: build.query<GetProductsResult, GetProductsArg>({
      query: (arg) => `product/${arg}`,
      providesTags: withArgAsId("Product")(), // it will provide tag { type: "Product", id: arg }
    }),
  }),
});
```

### Specifying Additional Tags

You can add additional tags in the arguments of the tagsProvider, or specify a callback that will return these tags.

```typescript
// it will provide tags [ { type: "Product", id: arg }, "Basket" ]
providesTags: withArgAsId("Product")(["Basket"]),

// or
providesTags: withArgAsId("Product")((result, error, arg) => ["Basket"]),
```

### Using multiply utils

You can nest one utility inside another. In order for the types to work correctly, you need to pass the Result and Arg types to each tag utility.

For example:

```typescript
const apiSlice = createApi({
  // omit other api creation options
  endpoints: (build) => ({
    getProducts: build.mutation<GetProductsResult, GetProductsArg>({
      query: (arg) => `product/${arg}`,
      providesTags: withArgAsId<GetProductsResult, GetProductsArg>("Product")(
        withNestedList<GetProductsResult, GetProductsArg>(
          "Basket",
          (result) => result.basket
        )(
          withNestedResultId<GetProductsResult, GetProductsArg>(
            "Coupon",
            (result) => result.coupon.id
          )()
        )
      ),
    }),
  }),
});
```

This is pretty unreadable :)

You can use the `withTags` utility to compose them and provide types to each one:

```typescript
import { withTags } from "./apiCacheUtils";

const apiSlice = createApi({
  // omit other api creation options
  endpoints: (build) => ({
    getProducts: build.mutation<GetProductsResult, GetProductsArg>({
      query: (arg) => `product/${arg}`,
      providesTags: withTags<GetProductsResult, GetProductsArg>([
        withArgAsId("Product"),
        withNestedList("Basket", (result) => result.basket), // result already typed
        withNestedResultId("Coupon", (result) => result.coupon.id),
      ])(),
    }),
  }),
});
```

> Note that when only **one** utility is used, types can be omitted.

## Utility Functions

Each function returns a tags provider function.

The provider **may** receive tags and return a callback that can be passed to the `providesTags`/`invalidatesTags` field in the `createApi` object of RTK Query.

You can combine them by nesting one inside another.

_P.S: Types are approximate_

### withList

```typescript
withList<R extends Record<"id", string | number>[], A>(type: TagTypes): TagsProvider
```

Adds tags with the specified type and ids: `"LIST"`, `id` property of items from the result array.

If the result is rejected, only a tag with the id `"LIST"` will be provided.

#### Example

```typescript
// Result
// [
//   { id: 1, message: "foo" },
//   { id: 2, message: "bar" },
// ];

withList("Product")();
// [
//   { type: "Product", id: "LIST"},
//   { type: "Product", id: 1 },
//   { type: "Product", id: 2 },
// ]
```

### withArgAsId

```typescript
withArgAsId<R, A extends string | number>(type: TagTypes): TagsProvider
```

Adds a tag with the specified type and the argument as the id.

#### Example

```typescript
// Argument - 5

withArgAsId("Product")();
// [{ type: "Product", id: 5 }]
```

### withNestedList

```typescript
withNestedList<R, A>(
  type: TagTypes,
  extractList: (result: R) => Record<"id", string | number>[]
): TagsProvider
```

Adds tags with the specified type and ids: `"LIST"`, `id` property of items from the extracted list.

The list is extracted from the result using the `extractList` function.

If the result is rejected, only a tag with the id `"LIST"` will be provided.

#### Example

```typescript
// Result
// {
//   nested: {
//     list: [
//       { id: 1, message: "foo" },
//       { id: 2, message: "bar" },
//     ],
//   },
// };

withNestedList("Product", (result) => result.nested.list)();
// [
//   { type: "Product", id: "LIST"},
//   { type: "Product", id: 1 },
//   { type: "Product", id: 2 },
// ]
```

### withNestedArgId

```typescript
withNestedArgId<R, A>(
  type: TagTypes,
  extractId: (arg: A) => string | number
): TagsProvider
```

Adds a tag with the specified type and the id, as an extracted field from the argument

#### Example

```typescript
// Argument - { id: 5 }

withNestedArgId("Product", (arg) => arg.id)();
// [{ type: "Product", id: 5 }]
```

### withNestedResultId

```typescript
withNestedResultId<R, A>(
  type: TagTypes,
  extractId: (result: R) => string | number
): TagsProvider
```

Adds a tag with the specified type and the id, as an extracted field from the result

#### Example

```typescript
// Result - { id: 5 }

withNestedArgId("Product", (res) => res.id)();
// [{ type: 'Product', id: 5 }]
```

### withDeepNestedList

```typescript
withDeepNestedList<R, A, IdItem extends Record<string, unknown>>(
  type: TagTypes,
  extractList: (result: R) => IdItem[],
  extractId: (item: IdItem) => string | number
): TagsProvider
```

Adds tags with the specified type and ids: `"LIST"`, ids as properties extracted from items in the extracted list.

The list is extracted from the result using the `extractList` function.

The id is extracted from each item in the list using the `extractId` function.

If the result is rejected, only a tag with the id `"LIST"` will be provided.

#### Example

```typescript
// Result
// {
//   nestedResult: [
//     { productId: 1 },
//     { productId: 2 },
//   ];
// }

withDeepNestedList(
  "Product",
  (result) => result.nestedResult,
  (item) => item.productId
)();
// [
//   { type: "Product", id: "LIST"},
//   { type: "Product", id: 1 },
//   { type: "Product", id: 2 },
// ]
```

### invalidateList

```typescript
invalidateList<R, A>(type: TagTypes): TagsProvider
```

Adds a tag with the specified type and id `"LIST"`.

#### Example

```typescript
invalidateList("Product")();
// [{ type: "Product", id: "LIST"}]
```

### invalidateOnSuccess

```typescript
invalidateOnSuccess(successTags?: Tags | () => Tags): TagsProvider
```

Adds the tags passed to the `successTags` argument, if the request is successful.

Otherwise, nothing will be provided.

#### Example

```typescript
invalidateOnSuccess(["Product"]); // success request
// ['Product']

invalidateOnSuccess(() => ["Product"]); // rejected request
// []
```

### withTags

```typescript
withTags<R, A>(tagsProviders: TagsProvider[]): TagsProvider
```

This function is used to compose multiple tags provider functions together and pass typings from the generic to each of them.

It provides a better way to type multiple tags providers.

#### Example

```typescript
withTags<ResultType, ArgType>([
  // no needed to pass typings for each of tags provider
  withList("BasketProduct"),
  withArgAsId("Basket"),
])(),
```

## Contributing

Contributions to `@bonzar/rtk-query-tags-util` are welcome! If you find any issues or would like to suggest new features/utils, please create a GitHub issue or submit a pull request.

## License

`@bonzar/rtk-query-tags-util` is open-source software licensed under the [MIT license](https://opensource.org/licenses/MIT).
