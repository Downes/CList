<?php
/**
 * Plugin Name: Author DID in Feeds
 * Plugin URI:  https://clist.mooc.ca/wordpress/README.html
 * Description: Adds a DID field to WordPress user profiles and exposes feed/post author DIDs in RSS2 and Atom feeds using rel="author" links.
 * Version:     0.1.2
 * Author:      Stephen Downes
 * Author URI:  https://www.downes.ca/
 * License:     GPL-2.0-or-later
 * Text Domain: author-did-feeds
 *
 * @package Author_DID_Feeds
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'Author_DID_Feeds' ) ) {
	/**
	 * Main plugin class.
	 */
	final class Author_DID_Feeds {
		/** User meta key used for the author DID. */
		const USER_META_KEY = 'did';

		/** Option key for a feed-level author DID. */
		const FEED_DID_OPTION = 'adf_feed_author_did';

		/** Option key for a feed-level author display name. */
		const FEED_NAME_OPTION = 'adf_feed_author_name';

		/**
		 * Register hooks.
		 */
		public static function init() {
			add_filter( 'user_contactmethods', array( __CLASS__, 'add_user_did_contact_method' ) );

			add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );

			add_action( 'rss2_head', array( __CLASS__, 'emit_rss2_feed_author_did' ) );
			add_action( 'rss2_item', array( __CLASS__, 'emit_rss2_item_author_did' ) );

			add_action( 'atom_head', array( __CLASS__, 'emit_atom_feed_author_did' ) );
			add_action( 'atom_entry', array( __CLASS__, 'emit_atom_entry_author_did' ) );
		}

		/**
		 * Add DID to the user profile contact fields.
		 *
		 * @param array $methods Existing contact methods.
		 * @return array
		 */
		public static function add_user_did_contact_method( $methods ) {
			if ( ! is_array( $methods ) ) {
				$methods = array();
			}

			$methods[ self::USER_META_KEY ] = __( 'DID', 'author-did-feeds' );
			return $methods;
		}

		/**
		 * Register optional feed-level DID settings on Settings > Reading.
		 */
		public static function register_settings() {
			register_setting(
				'reading',
				self::FEED_DID_OPTION,
				array(
					'type'              => 'string',
					'sanitize_callback' => array( __CLASS__, 'sanitize_did' ),
					'default'           => '',
				)
			);

			register_setting(
				'reading',
				self::FEED_NAME_OPTION,
				array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'default'           => '',
				)
			);

			add_settings_section(
				'adf_author_did_feeds_section',
				__( 'Author DID in Feeds', 'author-did-feeds' ),
				array( __CLASS__, 'render_settings_section' ),
				'reading'
			);

			add_settings_field(
				self::FEED_DID_OPTION,
				__( 'Feed author DID', 'author-did-feeds' ),
				array( __CLASS__, 'render_feed_did_field' ),
				'reading',
				'adf_author_did_feeds_section'
			);

			add_settings_field(
				self::FEED_NAME_OPTION,
				__( 'Feed author name', 'author-did-feeds' ),
				array( __CLASS__, 'render_feed_name_field' ),
				'reading',
				'adf_author_did_feeds_section'
			);
		}

		/**
		 * Render the settings section description.
		 */
		public static function render_settings_section() {
			echo '<p>' . esc_html__( 'Optional feed-level DID metadata. Per-post author DIDs come from each user profile\'s DID field.', 'author-did-feeds' ) . '</p>';
		}

		/**
		 * Render the feed author DID setting.
		 */
		public static function render_feed_did_field() {
			$value = (string) get_option( self::FEED_DID_OPTION, '' );

			printf(
				'<input type="text" class="regular-text code" name="%1$s" id="%1$s" value="%2$s" placeholder="did:web:www.downes.ca" />',
				esc_attr( self::FEED_DID_OPTION ),
				esc_attr( $value )
			);

			echo '<p class="description">' . esc_html__( 'Used as the author DID for the whole RSS2 or Atom feed.', 'author-did-feeds' ) . '</p>';
		}

		/**
		 * Render the feed author name setting.
		 */
		public static function render_feed_name_field() {
			$value = (string) get_option( self::FEED_NAME_OPTION, '' );

			printf(
				'<input type="text" class="regular-text" name="%1$s" id="%1$s" value="%2$s" placeholder="%3$s" />',
				esc_attr( self::FEED_NAME_OPTION ),
				esc_attr( $value ),
				esc_attr( get_bloginfo( 'name' ) )
			);

			echo '<p class="description">' . esc_html__( 'Display name attached to the feed-level DID link. If empty, the site title is used.', 'author-did-feeds' ) . '</p>';
		}

		/**
		 * Emit feed-level author DID in RSS2 channel metadata.
		 */
		public static function emit_rss2_feed_author_did() {
			self::emit_author_link( self::get_feed_author_did(), self::get_feed_author_name(), true );
		}

		/**
		 * Emit post-level author DID in RSS2 item metadata.
		 */
		public static function emit_rss2_item_author_did() {
			self::emit_author_link( self::get_current_post_author_did(), get_the_author(), true );
		}

		/**
		 * Emit feed-level author DID in Atom feed metadata.
		 */
		public static function emit_atom_feed_author_did() {
			self::emit_author_link( self::get_feed_author_did(), self::get_feed_author_name(), false );
		}

		/**
		 * Emit post-level author DID in Atom entry metadata.
		 */
		public static function emit_atom_entry_author_did() {
			self::emit_author_link( self::get_current_post_author_did(), get_the_author(), false );
		}

		/**
		 * Return the configured feed-level author DID.
		 *
		 * @return string
		 */
		private static function get_feed_author_did() {
			return self::sanitize_did( (string) get_option( self::FEED_DID_OPTION, '' ) );
		}

		/**
		 * Return the configured feed-level author name.
		 *
		 * @return string
		 */
		private static function get_feed_author_name() {
			$name = trim( (string) get_option( self::FEED_NAME_OPTION, '' ) );
			return $name !== '' ? $name : get_bloginfo( 'name' );
		}

		/**
		 * Return the current post author's DID.
		 *
		 * @return string
		 */
		private static function get_current_post_author_did() {
			$post = get_post();

			if ( ! $post ) {
				return '';
			}

			$did = get_the_author_meta( self::USER_META_KEY, (int) $post->post_author );
			return self::sanitize_did( (string) $did );
		}

		/**
		 * Emit an Atom link element, prefixed for RSS and unprefixed for Atom.
		 *
		 * @param string $did  DID or DID URL.
		 * @param string $name Human-readable author name.
		 * @param bool   $rss  Whether this is inside an RSS2 feed.
		 */
		private static function emit_author_link( $did, $name, $rss ) {
			if ( $did === '' ) {
				return;
			}

			$element = $rss ? 'atom:link' : 'link';
			$title   = trim( (string) $name );

			if ( $title !== '' ) {
				printf(
					"\t<%1\$s rel=\"author\" href=\"%2\$s\" title=\"%3\$s\" />\n",
					$element,
					esc_attr( $did ),
					esc_attr( $title )
				);
				return;
			}

			printf(
				"\t<%1\$s rel=\"author\" href=\"%2\$s\" />\n",
				$element,
				esc_attr( $did )
			);
		}

		/**
		 * Sanitize a DID or DID URL.
		 *
		 * This deliberately does not use esc_url() because WordPress may strip the did: scheme
		 * when it is not included in the allowed protocol list.
		 *
		 * @param mixed $did Raw DID value.
		 * @return string Sanitized DID, or empty string if invalid-looking.
		 */
		public static function sanitize_did( $did ) {
			if ( is_array( $did ) || is_object( $did ) ) {
				return '';
			}

			$did = trim( (string) $did );

			if ( $did === '' ) {
				return '';
			}

			// DID Core method names are lowercase ASCII letters and digits.
			// The method-specific identifier is kept permissive enough for did:web and DID URLs.
			if ( ! preg_match( '/^did:[a-z0-9]+:[^\s<>"\']+$/', $did ) ) {
				return '';
			}

			return $did;
		}
	}

	Author_DID_Feeds::init();
}
