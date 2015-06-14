#TODO

Inline context by searching for `TODO`

#Document

1. belongsTo
 - specify a relationship [Done in 0.9.3]
 - set the foreign key when passed a model [Done in 0.9.3]
 - lookup the model when getting the belongsTo key [Done in 0.9.3]

1. hasMany
 - specify the relationship
 - lookup the relation when getting the hasMany key

1. Assign an ID for models without one [Done in 1.0.0]
 - store the un-persisted state of a model as `persisted=false` [Done in 0.9.5]
 - update to `true` when the save succeeds [Done in 0.9.5]

1. Assign a createdAt on create [Done in 1.4.3]
1. Assign an updatedAt when saving [Done in 1.4.3]
1. Add a `permit` key on the class that specifies a hash
 - permit.update = list of fields that can be updated
 - permit.show = list of fields that can be presented back as JSON

#Relation

1.

#Persistence

1. Allow the default mapped (short) field names to be modified. [Done in 1.2.0]
1. Store / translate the short for the semantic long values [Done in 1.2.0]
 - name stored a n [Done in 1.2.0]
 - createdAt stored at cT [Done in 1.2.0]

