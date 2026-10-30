const pool = require("../config/db");
const { composeAddress } = require("../utils/serializers");

/**
 * Reference data for the admin form controls: clinical specialties,
 * organizational departments and clinic locations.
 *
 * The frontend currently hardcodes these lists; returning them from the
 * database means the form and the directory filter can never drift from the
 * rows they are filtering.
 */
async function getReferenceData() {
  const [specialties, departments, locations] = await Promise.all([
    pool.query(
      `SELECT id, name, slug, is_active
       FROM specialties
       ORDER BY name`
    ),
    pool.query(
      `SELECT d.id, d.name, d.slug, d.kind, d.specialty_id, d.is_active,
              s.name AS specialty_name
       FROM departments d
       LEFT JOIN specialties s ON s.id = d.specialty_id
       ORDER BY d.kind, d.name`
    ),
    pool.query(
      `SELECT id, name, address_line1, address_line2, city, country_code,
              timezone, phone, is_active
       FROM clinic_locations
       WHERE is_active
       ORDER BY name`
    ),
  ]);

  return {
    specialties: specialties.rows,
    departments: departments.rows,
    locations: locations.rows.map((row) => ({
      ...row,
      address: composeAddress(row.address_line1, row.city),
    })),
  };
}

module.exports = { getReferenceData };
