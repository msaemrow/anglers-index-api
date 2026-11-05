"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn("fish_catches", "personal_best", {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      }, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE fish_catches SET personal_best = true WHERE id IN (
          SELECT DISTINCT ON (user_id, species_id) id FROM fish_catches
          WHERE deleted_at IS NULL AND length > 0
          ORDER BY user_id, species_id, length DESC, id ASC
        );
        CREATE INDEX fish_catches_personal_best_lookup ON fish_catches (user_id, species_id)
          WHERE personal_best AND deleted_at IS NULL;

        CREATE FUNCTION lock_personal_best_owner() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          -- Serialize catch changes for an owner, including concurrent first catches.
          IF TG_OP = 'DELETE' THEN
            PERFORM id FROM users WHERE id = OLD.user_id FOR UPDATE;
            RETURN OLD;
          END IF;
          IF TG_OP = 'UPDATE' THEN
            PERFORM id FROM users WHERE id IN (OLD.user_id, NEW.user_id) ORDER BY id FOR UPDATE;
          ELSE
            PERFORM id FROM users WHERE id = NEW.user_id FOR UPDATE;
          END IF;
          RETURN NEW;
        END $$;
        CREATE FUNCTION refresh_personal_bests() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE affected record;
        BEGIN
          FOR affected IN SELECT DISTINCT user_id, species_id FROM (
            SELECT NEW.user_id, NEW.species_id WHERE TG_OP <> 'DELETE'
            UNION SELECT OLD.user_id, OLD.species_id WHERE TG_OP <> 'INSERT'
          ) pairs
          LOOP
            UPDATE fish_catches c SET personal_best = false
              WHERE c.user_id = affected.user_id AND c.species_id = affected.species_id AND c.personal_best;
            UPDATE fish_catches c SET personal_best = true WHERE c.id IN (
              SELECT DISTINCT ON (species_id) id FROM fish_catches
              WHERE user_id = affected.user_id AND species_id = affected.species_id AND deleted_at IS NULL AND length > 0
              ORDER BY species_id, length DESC, id ASC
            );
          END LOOP;
          RETURN NULL;
        END $$;
        CREATE TRIGGER personal_best_lock BEFORE INSERT OR DELETE OR UPDATE OF length, species_id, user_id, deleted_at
          ON fish_catches FOR EACH ROW EXECUTE FUNCTION lock_personal_best_owner();
        CREATE TRIGGER personal_best_refresh AFTER INSERT OR DELETE OR UPDATE OF length, species_id, user_id, deleted_at
          ON fish_catches FOR EACH ROW EXECUTE FUNCTION refresh_personal_bests();
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(`
        DROP TRIGGER personal_best_refresh ON fish_catches;
        DROP TRIGGER personal_best_lock ON fish_catches;
        DROP FUNCTION refresh_personal_bests();
        DROP FUNCTION lock_personal_best_owner();
        DROP INDEX fish_catches_personal_best_lookup;
      `, { transaction });
      await queryInterface.removeColumn("fish_catches", "personal_best", { transaction });
    });
  },
};
