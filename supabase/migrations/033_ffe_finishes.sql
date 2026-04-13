-- Migration 033: add ffe_finishes to spec_item_type enum
--
-- FF&E Finishes covers finish schedule items that belong to the FF&E category
-- rather than joinery (e.g. fabric specifications, paint colours on loose
-- furniture). Requested as a distinct schedule type separate from
-- joinery_finishes and arch_id_finishes.

alter type spec_item_type add value if not exists 'ffe_finishes';
