import React from 'react';
import MenuItems from './MenuItems'; // Add this import

function Header({ roleType }) {
  return (
    <header>
      {/* Other header content */}
      <MenuItems roleType={roleType} /> {/* Add MenuItems here */}
    </header>
  );
}

export default Header;
