export const PDC_CHECKLIST_SECTIONS = [
  {
    title: 'Start Stop',
    items: [
      { id: 'pre_driving_checks', label: 'Pre-driving checks outside and inside the vehicle' },
      { id: 'starting_procedure', label: 'Starting procedure' },
      { id: 'establishing_path', label: 'Establishing a path' },
      { id: 'gear_changing', label: 'Gear changing' },
      { id: 'stopping_vehicle', label: 'Stopping the vehicle' },
    ],
  },
  {
    title: 'Backing and Turning',
    items: [
      { id: 'turning_at_intersection', label: 'Turning right and left at an intersection' },
      { id: 'backing_side_street', label: 'Backing in and out of a side street' },
    ],
  },
  {
    title: 'Road Crossing and Light Traffic',
    items: [
      { id: 'road_crossing', label: 'Road crossing' },
      { id: 'driving_light_traffic', label: 'Driving in light traffic' },
    ],
  },
  {
    title: 'Maneuvering',
    items: [
      { id: 'y_turn_maneuvering', label: 'The “Y” turn and turn-about maneuvering style' },
    ],
  },
  {
    title: 'Hanging',
    items: [
      { id: 'y_turn_hanging', label: 'The “Y” turn and turn-about maneuvering style' },
    ],
  },
  {
    title: 'Garage Driving',
    items: [
      { id: 'driving_into_garage', label: 'Driving into a garage' },
      { id: 'driving_out_of_garage', label: 'Driving out of a garage' },
      { id: 'garage_backing_procedure', label: 'Driving into a garage using the backing procedure' },
    ],
  },
  {
    title: 'Parking',
    items: [
      { id: 'angle_parking', label: 'Entering and leaving an angle parking space' },
      { id: 'perpendicular_parking', label: 'Perpendicular parking' },
      { id: 'parallel_parking', label: 'Parallel parking' },
    ],
  },
  {
    title: 'Highway Driving',
    items: [
      { id: 'highway_traffic_situations', label: 'Driving on highways and encountering different traffic situations' },
    ],
  },
  {
    title: 'Heavy Traffic',
    items: [
      { id: 'heavy_traffic_attitudes', label: 'Acquaints the student with actual heavy-traffic driving conditions and develops correct driving attitudes' },
    ],
  },
  {
    title: 'Night Driving',
    items: [
      { id: 'night_driving_attitudes', label: 'Student must familiarize themselves with actual night-driving conditions', optional: true },
    ],
  },
];

export const PDC_CHECKLIST_ITEMS = PDC_CHECKLIST_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.title })),
);

export const PDC_CHECKLIST_ITEM_COUNT = PDC_CHECKLIST_ITEMS.filter((item) => !item.optional).length;
